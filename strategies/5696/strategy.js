/*
 * @coinsori-strategy v1
 * name: BTC Pure Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — tests a manual 55-bar-high breakout computed from the raw highs array.
 * When it buys and sells: Buys when previous close exceeds the 55-bar high, sells on 20-bar low or 20% stop.
 * When it does NOT work: Diagnostic only.
 */
function onUpdate(ctx) {
  const highs = ctx.highs;
  const lows = ctx.lows;
  if (!highs || !lows || highs.length < 60) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  // highest high of the 55 closed bars before the current one
  const upper = Math.max(...highs.slice(-56, -1));
  // lowest low of the 20 closed bars before the current one
  const lower = Math.min(...lows.slice(-21, -1));
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
