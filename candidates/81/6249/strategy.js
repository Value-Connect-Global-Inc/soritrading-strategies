/*
 * @coinsori-strategy v1
 * name: BTC Ride the 200 Pure 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Diagnostic — isolate whether the NDX gate or the ride-the-200 design is
 * what hurt W1 on the gated version. Stay long while price holds above EMA200, exit on a
 * close below it or a 5x ATR stop, no macro gate.
 * When it buys and sells: buy when price closes above EMA200 (after being below), sell when
 * price closes below EMA200, or the 5x ATR stop is hit.
 * When it does NOT work: in a choppy range that repeatedly crosses the 200 it whipsaws; the
 * wide stop gives back a large chunk in a sharp crash.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

  const ema200 = ctx.ema(200, 1);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema200prev == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);
  const prevClose = ctx.closes.at(-3);

  if (pos > 0) {
    const brokeDown = prevClose >= ema200prev && close < ema200;
    const stop = ctx.entryPx != null ? ctx.entryPx - 5 * atr : null;
    if (brokeDown || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '200-break/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '5x ATR stop' }]);
    return null;
  }

  const crossedUp = prevClose <= ema200prev && close > ema200;
  if (crossedUp) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'close above EMA200' }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
