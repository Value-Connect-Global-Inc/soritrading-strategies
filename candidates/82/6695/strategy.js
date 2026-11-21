/*
 * @coinsori-strategy v1
 * name: BTC Slow Regime Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends long stretches above or below its 200-bar average. This strategy is long only while price is above that line and steps aside when it breaks below — it captures most of bull runs while sitting out crashes, so its drawdowns are far smaller than holding.
 * When it buys and sells: It buys when price closes back above the 200-bar average and sells everything when price closes back below it. It never shorts and trades only a handful of times a month.
 * When it does NOT work: In a sideways market price wanders across the 200-bar line and every crossing pays fees. A sudden gap down exits late and eats part of the drop. It misses the start of a new bull because it waits for the average to catch up.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;
  const pos = ctx.position;
  const cash = ctx.cash || 0;

  // Closed-bar values so backtest, paper and live agree.
  const e200 = ctx.ema(200, 1);
  const close1 = ctx.closes.at(-2);
  if (e200 == null || close1 == null) { ctx.watch([]); return null; }

  const regimeUp = close1 > e200;   // price above the slow regime line

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const forceClosed = !!(ctx.alloc && ctx.alloc.lastForced);

  if (pos != null && pos > 0) {
    ctx.watch([{ side: 'sell', price: e200, trigger: 'below', note: 'regime break exit' }]);
    if (!regimeUp) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (!allocOk || forceClosed) { ctx.watch([]); return null; }

  if (regimeUp) {
    ctx.watch([{ side: 'buy', price: e200, trigger: 'above', note: 'regime up entry' }]);
    const qty = (cash / price) * 0.98;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
