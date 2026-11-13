/*
 * @coinsori-strategy v1
 * name: BTC Dual-MA Regime Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto trends persist — a coin above its long trend line tends to keep rising and below it tends to keep falling. We ride the up-trends and step aside in down-trends instead of holding through crashes.
 * When it buys and sells: Buy when price closes above the 200-period EMA (long regime turns up). Hold while price stays above the 50-period EMA; sell when it closes below the 50-EMA (medium trend breaks). Every position also carries a hard stop so a single fast crash cannot hurt the account.
 * When it does NOT work: In a sideways, choppy market price keeps crossing the trend lines and we whipsaw (buy high, sell low). It also misses any rally that starts while price is still below the 200-EMA.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema50 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;

  // In a position: exit when the medium trend breaks or the hard stop is hit
  if (ctx.position > 0) {
    const watch = [
      { side:'sell', price: ema50, trigger:'below', note:'trend exit' }
    ];
    if (ctx.entryPx != null) {
      const stop = ctx.entryPx - 3 * atr; // wide stop: absorbs noise, catches fast crashes
      watch.push({ side:'sell', price: stop, trigger:'below', note:'ATR stop' });
      if (price <= stop) {
        return { side:'sell', qty: ctx.position, reduceOnly: true };
      }
    }
    ctx.watch(watch);
    if (prevClose < ema50) {
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter once price is back above the long trend line
  const regimeUp = prevClose > ema200;
  ctx.watch([{ side:'buy', price: ema200, trigger:'above', note:'long regime' }]);
  if (regimeUp) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
