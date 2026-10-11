/*
 * BTC Chandelier Trend-Ride 1D
 * Idea: ride BTC's long-term uptrend but protect gains with a trailing stop.
 * Entry: price above 200-day SMA. Exit: price falls below the highest point
 * since entry minus 2.5x ATR — a stop that adapts to volatility.
 * 2025-01-01: display-only watch declarations added; trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const holding = ctx.position > 0;

  if (!holding) {
    if (price > sma200) {
      ctx.state.highest = price;
      ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'trend up', conds: [{ label: 'close > SMA200', ok: price > sma200, closed: true }] }]);
      return { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
    ctx.watch([]);
    return null;
  }

  // track highest high since entry
  if (ctx.state.highest == null || price > ctx.state.highest) {
    ctx.state.highest = price;
  }
  const highest = ctx.state.highest;
  const stop = highest - 2.5 * atr; // chandelier stop: 2.5x ATR below the peak
  ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' }]);

  if (price < stop) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
