/*
 * @coinsori-strategy v1
 * name: ETH Ride the 200 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A single long-term regime filter — stay long while price holds above its
 * EMA200, exit when it breaks below. Unlike an EMA50/200 crossover it does NOT exit on every
 * pullback, so it captures most of a long bull run (e.g. ETH 2020-21) while still stepping
 * aside in a real downtrend. A wide 5x ATR stop caps a single bad call.
 * When it buys and sells: buy when price closes above EMA200 (after being below), sell when
 * price closes below EMA200, or the 5x ATR stop is hit.
 * When it does NOT work: in a choppy range that repeatedly crosses the 200 it whipsaws and
 * pays fees; the stop is wide so a sharp crash can give back a large chunk before it exits.
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
