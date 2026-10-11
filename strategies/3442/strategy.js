/*
 * @coinsori-strategy v1
 * name: Bollinger Mean Reversion BTC 4h
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Prices frequently bounce after touching the lower Bollinger Band during normal volatility regimes.
 * When it buys and sells: Buys when the previous close falls below the lower Bollinger Band and RSI < 30. Sells when price crosses above the middle SMA band or RSI > 60.
 * When it does not work: Strong trending markets where price rides the lower band downwards.
 */

function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (bb == null || rsi == null) return null;

  const pos = ctx.position;
  const cash = ctx.cash;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  // Buy when price pierces lower band and RSI is oversold
  if (pos === 0 && prevClose < bb.lower && rsi < 30) {
    const qty = (cash / price) * 0.99;
    return { side: 'buy', qty };
  }

  // Sell when price reaches middle band or RSI recovers
  if (pos > 0 && (prevClose > bb.middle || rsi > 60)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
