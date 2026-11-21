/*
 * @coinsori-strategy v1
 * name: ETH 1H EMA Trend with ATR Trailing
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 1000
 *
 * Why this strategy: On 1h, ETH trends continue after an EMA breakout and an
 * ATR trailing stop locks in gains while letting winners run — trend
 * following, the opposite family of the failed mean-reversion attempt.
 * When it buys and sells: buy when EMA20 crosses above EMA50 (uptrend
 * start), exit when price falls back below the EMA20 or when the ATR
 * trailing stop is hit. Only long, no shorting.
 * When it does NOT work: choppy sideways ranges where EMAs whipsaw and
 * each cross is a false signal. The trailing stop keeps losses small.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const e20 = ctx.ema(20, 1);
  const e50 = ctx.ema(50, 1);
  const e20prev = ctx.ema(20, 2);
  const e50prev = ctx.ema(50, 2);
  const atr = ctx.atr(14, 1);
  if (e20 == null || e50 == null || e20prev == null || e50prev == null || atr == null) return null;

  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.99;

  if (ctx.position === 0) {
    // Enter only on a fresh golden cross (prev below, now above) — avoids
    // re-entering mid-trend after an exit.
    if (e20prev <= e50prev && e20 > e50) {
      ctx.watch([{ side:'buy', price: price, trigger:'above', note:'EMA20>EMA50 cross' }]);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // Trailing stop: exit when price closes below entry minus 3x ATR,
  // or when trend flips back below EMA20.
  const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
  ctx.watch([
    { side:'sell', price: e20, trigger:'below', note:'trend flip' },
    { side:'sell', price: stop, trigger:'below', note:'ATR trailing stop' }
  ]);
  if (price < e20) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (stop != null && price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
