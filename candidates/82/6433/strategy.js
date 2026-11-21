/*
 * @coinsori-strategy v1
 * name: BTC 4H Donchian Breakout Hard Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: 4h trend-following is the only family that has held up
 * in this job (a 5-asset 4h basket validated). This tests whether the edge
 * survives on BTC alone with a disciplined hard stop that the failed
 * VIX-regime attempt lacked.
 * When it buys and sells: buy when price breaks above the 20-bar high,
 * exit when price closes below the 10-bar low, with a hard 8% stop to cap
 * worst-case loss on every position.
 * When it does NOT work: prolonged sideways ranges give repeated false
 * breakouts; single-asset means no diversification to smooth that.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const dHigh = ctx.high(20, 1);  // highest high of last 20 closed bars
  const dLow = ctx.low(10, 1);    // lowest low of last 10 closed bars
  if (dHigh == null || dLow == null) return null;

  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.99;

  if (ctx.position === 0) {
    // Enter only on a breakout above the 20-bar high.
    if (price > dHigh) {
      ctx.watch([{ side:'buy', price: dHigh, trigger:'above', note:'20-bar high break' }]);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // Exit on 10-bar low break or hard 8% stop (8% = worst tail for BTC 4h).
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.92 : null;
  ctx.watch([
    { side:'sell', price: dLow, trigger:'below', note:'10-bar low break' },
    { side:'sell', price: stop, trigger:'below', note:'hard 8% stop' }
  ]);
  if (price < dLow) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (stop != null && price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
