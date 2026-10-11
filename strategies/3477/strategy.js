/*
 * @coinsori-strategy v1
 * name: MACD Trend Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Captures macro trend shifts using MACD crossovers filtered by a 200-period moving average to avoid counter-trend trades.
 * When it buys and sells: Buys when MACD crosses above signal while price is above SMA200, sells when MACD crosses below signal or price drops below SMA200.
 * When it does not work: Underperforms during sharp V-bottom reversals or prolonged ranging flat markets where MACD generates whipsaw signals.
 */
function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;
  
  const sma200 = ctx.sma(200, 1);
  const m1 = ctx.macd(12, 26, 9, 1);
  const m2 = ctx.macd(12, 26, 9, 2);
  
  if (sma200 == null || m1 == null || m2 == null || m1.macd == null || m1.signal == null || m2.macd == null || m2.signal == null) {
    return null;
  }
  
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend + MACD Cross' },
    { side: 'sell', price: p * 0.95, trigger: 'below', note: 'Stop Loss / MACD Crossunder' }
  ]);
  
  if (pos <= 0) {
    // Buy when MACD crosses above signal and price is above SMA200
    if (m2.macd <= m2.signal && m1.macd > m1.signal && p > sma200) {
      const qty = (ctx.cash / p) * 0.98;
      if (qty > 0) {
        return { side: 'buy', qty: qty };
      }
    }
  } else {
    // Sell when MACD crosses below signal or price drops below SMA200
    if ((m2.macd >= m2.signal && m1.macd < m1.signal) || p < sma200) {
      return { side: 'sell', qty: pos };
    }
  }
  
  return null;
}
