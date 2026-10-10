/*
 * @coinsori-strategy v1
 * name: BTC 200-Day Trend Filter 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The simplest robust defensive trend rule in existence — hold the
 * asset only while it trades above its 200-day average, sit in cash below it. BTC's
 * long history shows the 200d line separates sustained bull regimes (where the reward is)
 * from bear regimes (where the drawdown is). It is the opposite family to the RSI2 panic
 * basket: that one buys crashes, this one holds strength and only leaves when the trend
 * actually breaks. Few trades, low fee churn, no cross-symbol state needed.
 * When it buys and sells: Buys when the previous closed bar closes above the 200-day SMA.
 * Sells when a closed bar closes below the 200-day SMA. No stop — the filter is the stop.
 * When it does NOT work: In a long sideways chop oscillating around the 200-day line it
 * whipsaws and pays fees. It lags a sharp V-shaped bottom (waits for the trend to confirm).
 * It never shorts, so a multi-year bear is just flat (still beats holding the fall).
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1); // 200-day average of the previous CLOSED bar
  if (sma200 == null) return null;

  const pos = ctx.position;
  const above = price > sma200; // live price vs the closed 200d line — decide on the closed bar close instead
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const prevAbove = prevClose > sma200;

  if (pos > 0 && !prevAbove) {
    // trend broke on a CLOSED bar — exit
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200d trend' }]);
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && prevAbove) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200d trend' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  // no position change
  return null;
}
