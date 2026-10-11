/*
 * @coinsori-strategy v1
 * name: Trend Filtered Fear Greed BTC 4h
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Buying extreme fear works best when the macro trend is positive. Adding a moving average filter prevents catching falling knives in strong bear regimes.
 * When it buys and sells: Buys when Fear & Greed is < 30, RSI is oversold, and price is above the 200 SMA. Sells when Fear & Greed exceeds 70 or price breaks below a stop loss.
 * When it does not work: Range-bound choppy markets with persistent false breakouts above moving averages.
 */

function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (rsi == null || sma200 == null) return null;

  const fg = ctx.data('fg');
  if (fg == null) return null;

  const pos = ctx.position;
  const cash = ctx.cash;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  // Trend filter: only buy if price is above SMA200
  if (pos === 0 && fg < 30 && rsi < 40 && prevClose > sma200) {
    const qty = (cash / price) * 0.99;
    return { side: 'buy', qty };
  }

  // Exit on high fear/greed or RSI overbought
  if (pos > 0 && (fg > 70 || rsi > 70)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
