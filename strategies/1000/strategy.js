/*
 * @coinsori-strategy v1
 * name: MACD RSI Hybrid Mean Reversion Strategy
 * ex: binanceusdm
 * syms: BTCUSDT
 * interval: 1h
 * cash: 1000
 *
 * Why this strategy: This strategy combines MACD and RSI indicators to identify mean reversion opportunities in BTCUSDT. MACD helps detect trend shifts while RSI identifies overbought/oversold conditions, improving signal quality.
 * When it buys and sells: It buys when MACD crosses above its signal line and RSI is under 30 (oversold), and sells when MACD crosses below its signal line and RSI is over 70 (overbought).
 * When it does NOT work: This strategy may fail during strong trending markets where mean reversion signals conflict with trend direction, or in low volatility conditions where both indicators are unreliable.
 *
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  // Get indicators
  const macd = ctx.macd(12, 26, 9, 0);
  const macd_1 = ctx.macd(12, 26, 9, 1);
  const rsi = ctx.rsi(14, 0);
  const rsi_1 = ctx.rsi(14, 1);

  // Check for valid data
  if (macd == null || macd_1 == null || rsi == null || rsi_1 == null) {
    return null;
  }

  // Buy condition: MACD crosses above signal line and RSI is under 30 (oversold)
  const buyCondition = (macd_1.macd <= macd_1.signal && macd.macd > macd.signal) && rsi < 30;

  // Sell condition: MACD crosses below signal line and RSI is over 70 (overbought)
  const sellCondition = (macd_1.macd >= macd_1.signal && macd.macd < macd.signal) && rsi > 70;

  // Declare what we are waiting for (display only)
  if (ctx.position) {
    ctx.watch([{
      side: 'sell',
      note: 'MACD cross down + RSI>70',
      conds: [
        { label: 'MACD cross down', ok: (macd_1.macd >= macd_1.signal && macd.macd < macd.signal) },
        { label: 'RSI(14)', now: rsi, op: '>', ref: 70 }
      ]
    }]);
  } else {
    ctx.watch([{
      side: 'buy',
      note: 'MACD cross up + RSI<30',
      conds: [
        { label: 'MACD cross up', ok: (macd_1.macd <= macd_1.signal && macd.macd > macd.signal) },
        { label: 'RSI(14)', now: rsi, op: '<', ref: 30 }
      ]
    }]);
  }

  // Execute trades
  if (buyCondition) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  } else if (sellCondition) {
    return { side: 'sell', qty: ctx.position };
  }

  return null;
}
