/*
 * @coinsori-strategy v1
 * name: Fear Greed Mean Reversion BTC
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Extreme fear creates oversold panic in Bitcoin, offering high-probability mean-reversion buying opportunities.
 * When it buys and sells: Buys when Fear & Greed is extremely low (< 25) and price dips below Bollinger Bands, sells on recovery or RSI overbought.
 * When it does not work: In a prolonged secular bear market, extreme fear can persist indefinitely, leading to deeper drawdowns.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fg');
  if (fg == null) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null) return null;

  const price = ctx.closes.at(-2);
  const pos = ctx.position;

  if (pos === 0) {
    // Buy when sentiment is in extreme fear and price touches or goes below lower Bollinger Band
    if (fg < 25 && price <= bb.lower) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
  } else {
    // Sell when RSI recovers above 65 or price crosses above middle BB
    if (rsi > 65 || price >= bb.mid) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
