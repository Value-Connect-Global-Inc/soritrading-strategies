/*
 * @coinsori-strategy v1
 * name: Turtle Breakout BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC spends long stretches trending. A Donchian (Turtle) breakout rides
 *   those trends and exits quickly when they break, avoiding the worst of the bear.
 * When it buys and sells: Buys when price closes above the highest high of the last 55 days;
 *   sells when price closes below the lowest low of the last 20 days, or a -25% hard stop.
 * When it does NOT work: In a sideways chop it whipsaws and pays fees on every fake breakout.
 *   A 55-day breakout can also fire near the top of a cycle and give back 25% before the
 *   20-day exit triggers. It lags a sudden V-shape recovery.
 */
function onUpdate(ctx) {
  const entryHigh = ctx.high(55, 1); // Donchian entry channel, closed bars only
  const exitLow = ctx.low(20, 1);    // Donchian exit channel, closed bars only
  if (entryHigh == null || exitLow == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout' }]);
    if (price > entryHigh) {
      return { side: 'buy', qty: ctx.cash / price * 0.98 };
    }
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) return null;
  const stop = entry * 0.75; // hard stop -25%: caps a single losing trade
  const exitPx = Math.max(exitLow, stop);
  ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: '20d breakdown / stop' }]);
  if (price < exitPx) return { side: 'sell', qty: ctx.position };
  return null;
}
