/*
 * @coinsori-strategy v1
 * name: BTC 50D Symmetric Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: A symmetric moving-average filter — long above the 50-day
 * average, flat below it — uses the same speed for entry and exit. Unlike a
 * fast-exit/slow-entry design, it buys back at lower prices after a crash
 * instead of chasing the recovery, so it rides bull markets while dodging the
 * worst of bear phases.
 * When it buys and sells: buys when the 4h close crosses above the 50-day
 * average (300 4h bars); sells when the close crosses below it.
 * When it does NOT work: in a sideways chop around the average it flips on and
 * off and pays fees on both sides; a fast crash still exits late enough to lose.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma300_1 = ctx.sma(300, 1);
  const sma300_2 = ctx.sma(300, 2);
  if (sma300_1 == null || sma300_2 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: sma300_1, trigger: 'below', note: 'below 50-day MA' }]);
    if (close1 < sma300_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma300_1, trigger: 'above', note: 'above 50-day MA' }]);
  if (close1 > sma300_1 && close2 <= sma300_2) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
