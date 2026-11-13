/*
 * @coinsori-strategy v1
 * name: ETH Pure Trend EMA50/200 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Baseline trend-following on ETH with no macro gate. Tests whether the
 * NDX entry gate adds or subtracts value on a higher-beta asset whose rallies are often
 * crypto-specific. Buy on EMA50/200 up-cross, ride, exit on down-cross or 3x ATR stop.
 * When it buys and sells: buy when EMA50 crosses above EMA200, sell when EMA50 crosses below
 * EMA200, or the 3x ATR stop is hit.
 * When it does NOT work: in a flat chop the crossover whipsaws and pays fees; with no equity
 * gate it stays long through crypto bear markets that equities also suffer, so drawdowns are
 * larger than the gated version.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema50prev = ctx.ema(50, 2);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || ema50prev == null || ema200prev == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);

  if (pos > 0) {
    const trendDown = ema50prev >= ema200prev && ema50 < ema200;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (trendDown || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'trend/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  const trendUp = ema50prev <= ema200prev && ema50 > ema200;
  if (trendUp) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'EMA50/200 cross up' }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
