/*
 * @coinsori-strategy v1
 * name: SMA50/200 Trend Rider with Trailing Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Long-term trend following on Bitcoin — when the fast average crosses above the slow average the trend is up, and staying in until it crosses back down captures the big bull runs. A trailing stop locks in gains so we do not give back the whole peak before the death cross fires.
 * When it buys and sells: Buys when the 50-day average crosses above the 200-day average (golden cross) AND price is above the 200-day average. Sells when the 50-day average crosses below the 200-day average (death cross) OR price falls 20% from the highest point since entry (trailing stop).
 * When it does NOT work: In a sideways / choppy market the two averages cross back and forth and each cross costs fees — it needs a trending market. It also lags sharp turns, so a fast crash still costs up to 20% before the trailing stop fires.
 */
function onUpdate(ctx) {
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma50Prev = ctx.sma(50, 2);
  const sma200Prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma50Prev == null || sma200Prev == null) return null;

  const goldenCross = sma50Prev <= sma200Prev && sma50 > sma200;
  const deathCross = sma50Prev >= sma200Prev && sma50 < sma200;

  if (ctx.position <= 0) {
    ctx.state.peak = 0;
    if (goldenCross) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    return null;
  }

  // Track the highest price reached since entry.
  if (ctx.state.peak == null || ctx.price > ctx.state.peak) ctx.state.peak = ctx.price;

  // Exit on death cross (trend broken) or 20% trailing stop (lock in gains during the run).
  if (deathCross) return { side: 'sell', qty: ctx.position };
  if (ctx.state.peak > 0 && ctx.price < ctx.state.peak * 0.80) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
