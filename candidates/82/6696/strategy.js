/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Regime Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends long stretches above its 200-bar average, and pullbacks inside that stretch are usually temporary. This strategy stays long while price is above the slow average and protects the position with a trailing stop, so it captures most of a bull run while giving back much less than holding does on the way down.
 * When it buys and sells: It buys when price closes back above the 200-bar average. It sells when price closes back below that average, or when price falls 3 average-ranges below its highest point since entry (trailing stop). It never shorts and trades only a handful of times a month.
 * When it does NOT work: In a sideways market price wanders across the 200-bar line and every crossing pays fees. A sudden gap down exits late and eats part of the drop. It misses the start of a new bull because it waits for the average to catch up.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;
  const pos = ctx.position;
  const cash = ctx.cash || 0;

  // Closed-bar values so backtest, paper and live agree.
  const e200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const close1 = ctx.closes.at(-2);
  if (e200 == null || atr == null || close1 == null) { ctx.watch([]); return null; }

  const regimeUp = close1 > e200;   // price above the slow regime line

  // Highest close since entry, kept in ctx.state so it survives restarts.
  let peak = (ctx.state && ctx.state.peak) || 0;
  if (pos != null && pos > 0) {
    peak = Math.max(peak, close1);
    if (ctx.state) ctx.state.peak = peak;
  }

  if (pos != null && pos > 0) {
    // Chandelier stop: 3 ATR below the running peak (standard 3x multiple).
    const trail = peak - 3 * atr;
    ctx.watch([
      { side: 'sell', price: e200, trigger: 'below', note: 'regime break exit' },
      { side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' }
    ]);
    if (!regimeUp) {
      if (ctx.state) ctx.state.peak = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (price <= trail) {
      if (ctx.state) ctx.state.peak = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const forceClosed = !!(ctx.alloc && ctx.alloc.lastForced);
  if (!allocOk || forceClosed) { ctx.watch([]); return null; }

  if (regimeUp) {
    ctx.watch([{ side: 'buy', price: e200, trigger: 'above', note: 'regime up entry' }]);
    const qty = (cash / price) * 0.98;
    if (qty <= 0) return null;
    if (ctx.state) ctx.state.peak = close1;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
