/*
 * @coinsori-strategy v1
 * name: Fear Greed Contrarian BTC 4h
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Extreme fear in the market often presents oversold buying opportunities, while extreme greed signals local tops.
 * When it buys and sells: Buys when Fear & Greed index drops below 25 (extreme fear) and RSI is oversold; sells when Fear & Greed rises above 75 or RSI becomes overbought.
 * When it does not work: In a prolonged structural bear market, extreme fear can persist indefinitely while prices continue to drop.
 */

function onUpdate(ctx) {
  // Guard early bars
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  // Read external fear and greed sentiment dataset
  const fg = ctx.data('fg');
  if (fg == null) return null;

  const pos = ctx.position;
  const cash = ctx.cash;
  const price = ctx.price;

  // Buy on Extreme Fear (< 25) and RSI < 35
  if (pos === 0 && fg < 25 && rsi < 35) {
    const qty = (cash / price) * 0.99;
    return { side: 'buy', qty };
  }

  // Sell/Exit on Extreme Greed (> 75) or RSI > 70
  if (pos > 0 && (fg > 75 || rsi > 70)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
