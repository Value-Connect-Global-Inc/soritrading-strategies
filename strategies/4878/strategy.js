/*
 * @coinsori-strategy v1
 * name: SMA200 Golden-Cross BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's long-term price trend is upward, but it goes through
 * violent bear markets. The 200-day average separates "healthy uptrend" from "broken
 * downtrend"; a trailing stop from the highest price since entry gets out of a bear
 * long before the slow 200-day average does.
 * When it buys and sells: Buy when the daily close crosses back above its 200-day
 * average. Sell when price falls more than 25% from the highest point reached since
 * entry (trailing stop), or when the close falls back below the 200-day average.
 * When it does NOT work: In long sideways ranges price crosses the 200-day average
 * many times, producing small whipsaw losses. It also buys late — after the first big
 * leg of a new bull market is already over — and a 25% trailing stop gives back part
 * of every top before selling.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || sma200Prev == null || prevClose == null) return null;

  const s = ctx.state || (ctx.state = {});
  const pos = ctx.position || 0;

  if (pos === 0) {
    // Buy when the last CLOSED bar crossed back above the 200-day average.
    if (prevClose > sma200Prev && ctx.closes.at(-3) <= sma200Prev) {
      ctx.watch([{ side: 'sell', price: ctx.price * 0.75, trigger: 'below', note: 'trail stop -25%' }]);
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'above 200d avg' }]);
    return null;
  }

  // Ratchet the highest price seen since entry.
  s.highestPx = Math.max(s.highestPx ?? ctx.price, ctx.price);
  // 25% trailing stop: tight enough to exit a bear early, wide enough to survive bull pullbacks.
  const trailStop = s.highestPx * 0.75;
  const stop = Math.max(trailStop, sma200);
  ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trail/200d stop' }]);
  if (ctx.price <= stop) return { side: 'sell', qty: pos };
  return null;
}
