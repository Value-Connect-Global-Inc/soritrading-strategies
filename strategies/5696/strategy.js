/*
 * @coinsori-strategy v1
 * name: BTC Pure Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — tests a close-based 55-bar-high breakout computed from the closes array only.
 * When it buys and sells: Buys when previous close exceeds the highest close of the 55 prior bars, sells on 20-bar low or 20% stop.
 * When it does NOT work: Diagnostic only.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (!closes || closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;
  // highest close of the 55 bars BEFORE the previous bar (excludes prevClose itself)
  const upper = Math.max(...closes.slice(-57, -2));
  // lowest close of the 20 bars BEFORE the previous bar
  const lower = Math.min(...closes.slice(-22, -2));
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
