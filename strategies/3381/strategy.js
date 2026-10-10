/*
 * @coinsori-strategy v1
 * name: BTC MACD Momentum Trend 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (price above the 200-day average), MACD crosses above its signal line mark the start of momentum legs that tend to continue on daily BTC.
 * When it buys and sells: Buys when the MACD line crosses above its signal line while price is above the 200-day average. Sells when MACD crosses back below signal, when price falls below the 200-day average, or a 2.5x ATR hard stop is hit.
 * When it does NOT work: In choppy, sideways markets the MACD cross fires repeatedly and each whip costs money. It also misses sharp V-reversals that never let MACD confirm.
 */
function onUpdate(ctx) {
  // Long-term regime: price must be above its 200-day average to allow trades.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);

  // If we hold and the 200-day regime breaks, exit immediately.
  if (ctx.position > 0 && prevClose < sma200) return { side: 'sell', qty: ctx.position };

  // MACD on closed bars (ago 1 vs 2) so backtest, paper and live agree.
  const m1 = ctx.macd(12, 26, 9, 1);
  const m2 = ctx.macd(12, 26, 9, 2);
  if (m1 == null || m2 == null || m1.signal == null || m2.signal == null) return null;

  // Hard stop below entry scaled to volatility (2.5x ATR(14) ~ 5% of price on daily BTC).
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (ctx.position > 0) {
    // Exit on MACD bearish cross or hard stop.
    if (m1.macd < m1.signal && m2.macd >= m2.signal) return { side: 'sell', qty: ctx.position };
    const stopPx = ctx.entryPx - 2.5 * atr;
    if (ctx.price < stopPx) return { side: 'sell', qty: ctx.position };
    return null;
  }

  // Enter on MACD bullish cross while above the 200-day regime.
  if (m2.macd <= m2.signal && m1.macd > m1.signal) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
