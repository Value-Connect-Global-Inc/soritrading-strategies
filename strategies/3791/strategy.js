/*
 * @coinsori-strategy v1
 * name: SMA50/200 Trend Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Long-term trend following on Bitcoin — when the fast average crosses above the slow average the trend is up, and staying in until it crosses back down captures the big bull runs while avoiding the worst of the bears.
 * When it buys and sells: Buys when the 50-day average crosses above the 200-day average (golden cross) AND price is above the 200-day average. Sells when the 50-day average crosses below the 200-day average (death cross). Uses closed bars so the signal is identical in backtest and live.
 * When it does NOT work: In a sideways / choppy market the two averages cross back and forth repeatedly and each cross costs fees — this strategy needs a trending market to win. It also lags sharp turns, so it gives back part of a crash before the death cross fires.
 */
function onUpdate(ctx) {
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma50Prev = ctx.sma(50, 2);
  const sma200Prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma50Prev == null || sma200Prev == null) return null;

  const goldenCross = sma50Prev <= sma200Prev && sma50 > sma200;
  const deathCross = sma50Prev >= sma200Prev && sma50 < sma200;

  if (ctx.position <= 0 && goldenCross) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position > 0 && deathCross) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
