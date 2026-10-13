/*
 * @coinsori-strategy v1
 * name: SMA50/200 Trend Rider v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Long-term trend following on Bitcoin — enter when the fast average crosses above the slow average AND the slow average is still rising (the trend is confirmed, not a dead-cat bounce in a bear). Exit when the fast average crosses back below the slow average.
 * When it buys and sells: Buys when the 50-day average crosses above the 200-day average (golden cross) AND the 200-day average is rising. Sells when the 50-day average crosses below the 200-day average (death cross). Uses closed bars.
 * When it does NOT work: In a sideways / choppy market the two averages cross back and forth and each cross costs fees. The rising-200d filter means it also ignores the first part of a new bull right after a long bear (waits for the 200d to turn up).
 */
function onUpdate(ctx) {
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma50Prev = ctx.sma(50, 2);
  const sma200Prev = ctx.sma(200, 2);
  const sma200PrevPrev = ctx.sma(200, 3);
  if (sma50 == null || sma200 == null || sma50Prev == null || sma200Prev == null || sma200PrevPrev == null) return null;

  const goldenCross = sma50Prev <= sma200Prev && sma50 > sma200;
  const deathCross = sma50Prev >= sma200Prev && sma50 < sma200;
  const sma200Rising = sma200 > sma200Prev;

  if (ctx.position <= 0 && goldenCross && sma200Rising) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position > 0 && deathCross) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
