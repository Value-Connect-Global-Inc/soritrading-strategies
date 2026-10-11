/*
 * @coinsori-strategy v1
 * name: Dual SMA Trend Following BTC 4h
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend following captures major multi-month directional moves while cutting short losses during choppy periods.
 * When it buys and sells: Buys when the 20 SMA crosses above the 50 SMA and RSI > 50. Sells when the 20 SMA crosses below the 50 SMA or price hits a trailing ATR stop.
 * When it does not work: Sideways ranging markets with frequent false crossovers.
 */

function onUpdate(ctx) {
  const sma20 = ctx.sma(20, 1);
  const sma50 = ctx.sma(50, 1);
  const prevSma20 = ctx.sma(20, 2);
  const prevSma50 = ctx.sma(50, 2);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);

  if (sma20 == null || sma50 == null || prevSma20 == null || prevSma50 == null || rsi == null || atr == null) return null;

  const pos = ctx.position;
  const cash = ctx.cash;
  const price = ctx.price;
  const entryPx = ctx.entryPx;

  // Bullish crossover: 20 SMA crosses above 50 SMA with supportive RSI
  if (pos === 0 && prevSma20 <= prevSma50 && sma20 > sma50 && rsi > 50) {
    const qty = (cash / price) * 0.99;
    return { side: 'buy', qty };
  }

  // Bearish crossover or ATR stop loss exit
  if (pos > 0) {
    if (prevSma20 >= prevSma50 && sma20 < sma50) {
      return { side: 'sell', qty: pos };
    }
    // ATR stop loss: 3 * ATR below entry price
    if (price <= entryPx - 3 * atr) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
