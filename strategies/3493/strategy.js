/*
 * @coinsori-strategy v1
 * name: MomentumTrendStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong intermediate momentum swings in Bitcoin when both MACD crossover and RSI confirm trend direction above the 200 SMA.
 * When it buys and sells: Buys when MACD is bullish, RSI is above 50, and price is above the 200 SMA. Sells on MACD bearish crossover or trailing stop.
 * When it does NOT work: Whipsaws in tight ranging markets where MACD crosses frequently without sustained direction.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const sma200 = ctx.sma(200);
  const m1 = ctx.macd(12, 26, 9, 1);
  const m2 = ctx.macd(12, 26, 9, 2);
  const rsi = ctx.rsi(14);
  const atr = ctx.atr(14);

  if (sma200 == null || m1 == null || m2 == null || rsi == null || atr == null) return null;

  const pos = ctx.position;

  // Exit logic
  if (pos > 0) {
    const entryPx = ctx.entryPx;
    if (m1.macd < m1.signal || p <= entryPx - 2.0 * atr || p >= entryPx + 4.0 * atr) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: entryPx + 4.0 * atr, trigger: 'above', note: 'Take Profit' },
      { side: 'sell', price: entryPx - 2.0 * atr, trigger: 'below', note: 'Stop Loss' }
    ]);
    return null;
  }

  // Entry logic
  if (p > sma200 && m2.macd <= m2.signal && m1.macd > m1.signal && rsi > 50 && rsi < 70) {
    const qty = (ctx.cash / p) * 0.99;
    if (qty > 0) {
      ctx.watch([{ side: 'buy', price: p, trigger: 'above', note: 'MACD Bullish Cross with RSI' }]);
      return { side: 'buy', qty: qty };
    }
  }

  ctx.watch([{ side: 'buy', price: p, trigger: 'above', note: 'Waiting for MACD cross' }]);
  return null;
}
