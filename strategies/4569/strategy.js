/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket v4
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * In crypto, momentum persists: when the crowd is greedy (index >= 55) prices
 * keep climbing, and when the crowd turns fearful (index <= 40) the trend has
 * broken. This rides confirmed sentiment on a 4-coin basket so no single asset
 * decides the account.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND price
 * is above its 200-day average (closed bar). Sell when Fear & Greed <= 40 or
 * when price falls 20% below the highest price since entry (trailing stop that
 * locks in gains; it never lets a winning trade turn into a -25% loss).
 * When it does NOT work: in a fast crash the index can still be high while
 * prices are already falling (the index lags) — the 200-day entry filter
 * reduces these entries but cannot remove all of them. It misses the very
 * start of a bull because it waits for confirmed greed, and the 20% trail can
 * be hit by a normal dip after a sharp run-up, selling a still-good trend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  // 200-day average on the CLOSED bar: identical in backtest, paper and live.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    const entry = ctx.entryPx;
    if (entry == null) return null;

    // Trail the highest price seen since entry (per-symbol state).
    const hi = ctx.state && ctx.state.hi != null ? Math.max(ctx.state.hi, price) : price;
    ctx.state = { hi: hi };
    // Trailing stop 20% below the running high, never worse than -25% from
    // entry: locks in gains instead of a fixed stop that realizes a normal dip.
    const stop = Math.max(entry * 0.75, hi * 0.80);
    if (price <= stop) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trail 20%' }]);
    return null;
  }

  // Flat: reset the trailing high.
  if (ctx.state && ctx.state.hi != null) ctx.state = { hi: null };

  // Trend filter on entry: only buy when price is above its 200-day average
  // (closed bar) so we do not buy into a downtrend the index has not yet seen.
  if (fg >= 55 && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true }]
  }]);
  return null;
}
