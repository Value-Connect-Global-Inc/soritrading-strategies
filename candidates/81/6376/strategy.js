/*
 * @coinsori-strategy v1
 * name: BTC 200D Trend Long-Flat (no stop) 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC alternates between long bull trends and deep bear markets. On daily
 * data the 200-day average is a real ~8-month trend line. A pure long-flat flip on it stays
 * fully invested through the 2019 and 2020-21 bulls and steps aside before the 2018 and 2022
 * crashes — the classic long-term trend strategy.
 * When it buys and sells: Buys the full account when the last closed daily close is above the
 * 200-day average; sells everything when the close falls below it. No tight stop: a 30%
 * drawdown is normal BTC volatility, so a narrow stop would knock us out of every rally.
 * When it does NOT work: In a long sideways range the price crosses the 200-day line a few
 * times and the strategy pays fees for little gain; it also misses the first weeks of a new
 * rally because it waits for a daily close to confirm.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);   // closed-bar 200-day trend, no look-ahead
  if (sma200 == null) return null;

  const inTrend = price > sma200;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'above 200D' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'break 200D' }
  ]);

  if (ctx.position > 0) {
    if (!inTrend) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }
  if (inTrend) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
