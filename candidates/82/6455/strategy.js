/*
 * @coinsori-strategy v1
 * name: BTC EMA200 Trend Ride Spot 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Long-only version of the EMA200 trend ride on spot: buy BTC when price is
 * clearly above a rising EMA200, sell back to cash when the trend flips down.
 * No shorting — the goal is to capture most of an uptrend while stepping aside
 * in crashes, giving a similar return to holding with a much smaller drawdown.
 * Does not work in long sideways ranges where price chops around a flat EMA.
 */
function onUpdate(ctx) {
  const ema = ctx.ema(200, 1);
  const emaPrev = ctx.ema(200, 2);
  if (ema == null || emaPrev == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2);
  const trendUp = prevClose > ema;
  const slopeUp = ema > emaPrev;

  // Only enter when the trend is clearly established — 1.5% beyond the EMA —
  // so whipsaw flips near the EMA do not generate fee-paying round trips.
  const clearUp = prevClose > ema * 1.015;

  const price = ctx.price;
  const pos = ctx.position || 0;

  const watch = [];

  if (pos > 0) {
    watch.push({ side: 'sell', price: ema, trigger: 'below', note: 'trend down exit' });
    ctx.watch(watch);
    if (!trendUp) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  watch.push({ side: 'buy', price: ema, trigger: 'above', note: 'EMA200 up' });
  ctx.watch(watch);

  if (clearUp && slopeUp) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
