/*
 * @coinsori-strategy v1
 * name: FearGreed Regime Basket v9 BreakevenLock
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge
 * and momentum persists in crypto: when the crowd is greedy (index >= 55)
 * prices keep climbing, and when the crowd turns fearful (index <= 40) the
 * trend has broken. This rides confirmed sentiment on a 4-coin basket so no
 * single asset decides the account. v9 adds an ASYMMETRIC profit lock: once a
 * position is up >= 50%, the stop rises to breakeven entry, so a big winner
 * can never turn into a loss. Unlike a trailing stop it does not whipsaw on
 * normal 20-30% dips — it only fires on a FULL round-trip to entry.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND
 * price is above its 200-day average AND the Fed is not hiking. Sell when it
 * falls to <= 40, or price drops 25% below entry (hard stop), or — once the
 * position has been up >= 50% — when price falls back to entry (breakeven).
 * When it does NOT work: in a fast crash the index can still be high while
 * prices are already falling (the index lags), and a coin that rounds-trips
 * to entry after a big gain is sold at breakeven then may recover — missing
 * the second leg. It misses the very start of a bull because it waits for
 * confirmed greed.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;

    // Track the highest price since entry. ctx.state is SHARED across symbols,
    // so key the peak by symbol (learned from the multi-asset MR basket).
    const key = 'peak_' + ctx.sym;
    const prevPeak = ctx.state[key] != null ? Number(ctx.state[key]) : entry;
    const peak = Math.max(prevPeak, price);
    ctx.state[key] = peak;

    // Breakeven lock: once up >= 50%, the stop rises to entry so a big winner
    // can never turn into a loss. Before that, the fixed -25% stop applies.
    const lockActive = peak >= entry * 1.5;
    const stopPx = lockActive ? entry : entry * 0.75;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: lockActive ? 'stop: breakeven' : 'stop: -25%' }]);

    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    return null;
  }

  // Flat: reset the peak for the next entry.
  ctx.state['peak_' + ctx.sym] = null;

  // Trend filter: only enter when price is above its 200-day average (closed
  // bar). The F&G index lags price in a fast crash — this avoids buying into
  // a downtrend that the index has not yet registered.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Fed liquidity filter: only buy while the Fed is NOT hiking — current fed
  // funds rate above its 30-day-ago value = tightening = hostile for a
  // zero-yield risk asset. Missing data = not hiking (permissive).
  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  if (fg >= 55 && price > sma200 && !fedHiking) {
    // Fixed 95% sizing (v3 behaviour) — vol-targeting cut bull-market returns.
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up & fed ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking }]
  }]);
  return null;
}
