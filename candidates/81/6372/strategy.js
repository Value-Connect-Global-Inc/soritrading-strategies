/*
 * @coinsori-strategy v1
 * name: BTC 4h SMA200 Trend Long-Flat
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC alternates between long 4h trends and sharp bear markets. Stay long while price holds above its 200-bar average, go to cash when it falls below — rides the up-trends and steps out of the down-trends.
 * When it buys and sells: Buys the full account when the last closed 4h price is above the 200-bar SMA; sells everything when it closes below the SMA. A wide 25% stop is only a catastrophe guard, rarely hit.
 * When it does NOT work: In a long sideways range the price keeps crossing the average and the strategy whipsaws in and out, paying fees for no gain. It also misses the very first part of a new rally because it waits for the close to confirm.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);   // closed-bar trend, no look-ahead
  if (sma200 == null) return null;

  const inTrend = price > sma200;
  // Wide catastrophe stop only (25%): prevents ruin, far too wide to cause churn
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' },
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
