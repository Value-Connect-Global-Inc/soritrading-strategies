/*
 * @coinsori-strategy v1
 * name: SlowTrend100_200 ATRStop
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly over multi-year periods; a very slow 100/200-day EMA crossover catches the big trends while avoiding the whipsaw that faster EMAs (20/50) suffer on 1d.
 * When it buys and sells: Buys when the 100-day EMA crosses above the 200-day EMA (closed bars only). Sells when it crosses back below, or when price drops 2.5x ATR(14) below the entry (hard stop).
 * When it does NOT work: In long sideways chop with no trend the slow cross still makes a few losing round-trips. A sharp crash can stop out before the cross exits. It will not keep up with buy-and-hold in a straight bull market.
 */
function onUpdate(ctx) {
  const fast = ctx.ema(100, 1);
  const slow = ctx.ema(200, 1);
  if (fast == null || slow == null) return null;
  const prevFast = ctx.ema(100, 2);
  const prevSlow = ctx.ema(200, 2);
  if (prevFast == null || prevSlow == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const price = ctx.price;

  let watch = [];

  // Hard stop: 2.5x ATR below entry price. 2.5x ATR(14) on BTC 1d ~ 8-10% price move, a reasonable single-trade loss cap.
  if (ctx.position > 0 && ctx.entryPx != null) {
    const stop = ctx.entryPx - 2.5 * atr;
    watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
    if (price <= stop) return { side: 'sell', qty: ctx.position };
  }

  // Trend exit: 100 EMA crosses below 200 EMA
  if (ctx.position > 0) {
    if (prevFast > prevSlow && fast <= slow) {
      return { side: 'sell', qty: ctx.position };
    }
  }

  // Trend entry: 100 EMA crosses above 200 EMA
  if (ctx.position === 0) {
    if (prevFast <= prevSlow && fast > slow) {
      const qty = (ctx.cash / price) * 0.99;
      ctx.watch(watch);
      return { side: 'buy', qty };
    }
    ctx.watch(watch);
    return null;
  }

  ctx.watch(watch);
  return null;
}
