/*
 * @coinsori-strategy v1
 * name: BTC 200D Trend Long-Flat 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC spends most of its time in long bull trends lasting months, punctuated
 * by deep bear markets. On daily data a 200-day moving average is a real ~8-month trend line:
 * stay fully invested while price is above it, move to cash when it closes below it.
 * When it buys and sells: buys the full account when the last closed daily close is above the
 * 200-day SMA; sells everything when the close falls below it. A 30% stop is only a
 * catastrophe guard, rarely hit.
 * When it does NOT work: in a long sideways range the price crosses the 200-day line a few
 * times and the strategy pays fees for little gain; it also misses the first weeks of a new
 * rally because it waits for a daily close to confirm.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);   // closed-bar 200-day trend, no look-ahead
  if (sma200 == null) return null;

  const inTrend = price > sma200;
  // 30% catastrophe stop only — far too wide to cause churn, prevents ruin
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.70 : null;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'above 200D' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'break 200D' },
    { side: 'sell', price: stop, trigger: 'below', note: 'catastrophe stop' }
  ]);

  if (ctx.position > 0) {
    if (!inTrend || (stop != null && price <= stop)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }
  if (inTrend) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
