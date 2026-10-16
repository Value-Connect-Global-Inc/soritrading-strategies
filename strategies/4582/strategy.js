/*
 * @coinsori-strategy v1
 * name: FearGreed Regime Basket v6 TrendBreakExit
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge
 * and momentum persists in crypto: when the crowd is greedy (index >= 55)
 * prices keep climbing, and when the crowd turns fearful (index <= 40) the
 * trend has broken. This rides confirmed sentiment on a 4-coin basket. v6
 * adds a trend-break exit: it closes when price falls back below its 200-day
 * average, because the sentiment index LAGS price in a fast crash — by the
 * time the index drops to 40 the drawdown is already deep. The trend filter
 * that gates entries is now also the exit.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND
 * price is above its 200-day average AND the Fed is not hiking. Sell when
 * price closes below the 200-day average (trend break), or the sentiment
 * index falls to <= 40, or price drops 25% below entry (hard stop).
 * When it does NOT work: in a choppy sideways market price whipsaws around
 * the 200-day average, causing repeated small exits and re-entries. It still
 * misses the very start of a bull because it waits for confirmed greed, and
 * a fast crash can pierce the 25% stop before the trend-break exit fires.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  // Trend filter on CLOSED bar (ago=1) — identical in backtest, paper, live.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    // v6: trend-break exit — the entry premise was "trend up"; when price
    // falls back below the 200-day average, get out before the lagging
    // sentiment index confirms the break. This is the biggest change.
    if (price < sma200) return { side: 'sell', qty: pos };

    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on any single position (fast-crash
      // backstop when the trend break has not fired yet).
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    return null;
  }

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
