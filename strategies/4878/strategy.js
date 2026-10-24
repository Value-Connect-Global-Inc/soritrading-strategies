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
 * downtrend". This is the purest form of the idea: long while price is above the
 * 200-day average, cash while below — no extra stops that cause churn.
 * When it buys and sells: Buy when the daily close crosses back above its 200-day
 * average. Sell when the close falls back below the 200-day average.
 * When it does NOT work: In long sideways ranges price crosses the 200-day average
 * many times, producing small whipsaw losses. It also buys late — after the first big
 * leg of a new bull market is already over — and gives back part of every top because
 * it never sells at the exact peak.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || sma200Prev == null || prevClose == null) return null;

  const pos = ctx.position || 0;

  if (pos === 0) {
    // Buy when the last CLOSED bar crossed back above the 200-day average.
    if (prevClose > sma200Prev && ctx.closes.at(-3) <= sma200Prev) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'above 200d avg' }]);
    return null;
  }

  // Sell when the close falls back below the 200-day average.
  ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'below 200d avg' }]);
  if (prevClose < sma200) return { side: 'sell', qty: pos };
  return null;
}
