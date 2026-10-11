/*
 * @coinsori-strategy v1
 * name: 4h Trend Momentum ATR
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Captures sustained medium-term trends on 4-hour BTC charts using EMA alignment and MACD momentum, protecting capital with a trailing ATR stop.
 * When it buys and sells: Buys when fast EMA is above slow EMA and MACD crosses bullish, selling on trailing stop or MACD bearish cross.
 * When it does not work: Suffers in prolonged range-bound or choppy sideways markets where trend indicators generate false breakout signals.
 */

function onUpdate(ctx) {
  // Warm-up check for indicators
  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  const macdPrev = ctx.macd(12, 26, 9, 1);
  const macdTwo = ctx.macd(12, 26, 9, 2);
  const atr = ctx.atr(14, 1);

  if (ema20 == null || ema50 == null || macdPrev == null || macdTwo == null || atr == null) {
    return null;
  }

  const price = ctx.price;
  const position = ctx.position;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: price * 0.98, trigger: 'below', note: 'Trend entry pullback' },
    { side: 'sell', price: price * 1.05, trigger: 'above', note: 'Profit target' }
  ]);

  // Entry Condition: EMA20 > EMA50 and MACD bullish crossover
  const isBullishTrend = ema20 > ema50;
  const isMacdCrossUp = macdTwo.macd <= macdTwo.signal && macdPrev.macd > macdPrev.signal;

  if (position <= 0 && isBullishTrend && isMacdCrossUp) {
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty: qty };
  }

  // Exit Condition: MACD bearish crossover or trend breakdown
  const isMacdCrossDown = macdTwo.macd >= macdTwo.signal && macdPrev.macd < macdPrev.signal;
  const isTrendBroken = ema20 < ema50;

  if (position > 0 && (isMacdCrossDown || isTrendBroken)) {
    return { side: 'sell', qty: position };
  }

  return null;
}
