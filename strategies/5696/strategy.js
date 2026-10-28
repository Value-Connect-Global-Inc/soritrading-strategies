/*
 * @coinsori-strategy v1
 * name: BTC Pure Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — does a plain 55-day-high breakout with ctx.high() produce trades?
 * When it buys and sells: Buys when previous close exceeds the 55-bar high, sells on 20-bar low or 20% stop.
 * When it does NOT work: Diagnostic only.
 */
function onUpdate(ctx) {
  const upper = ctx.high(55, 1);
  const lower = ctx.low(20, 1);
  const prevClose = ctx.closes.at(-2);
  if (upper == null || lower == null || prevClose == null) return null;
  if (ctx.position > 0) {
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null;
    if (prevClose < lower) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (prevClose > upper) {
    return { side: 'buy', qty: (0.9 * ctx.cash) / ctx.price * 0.99 };
  }
  return null;
}
