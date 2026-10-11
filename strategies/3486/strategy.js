/*
 * @coinsori-strategy v1
 * name: TrendFollowingMacdStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures sustained medium-term trends by combining EMA alignment with MACD crossovers during healthy volatility.
 * When it buys and sells: Buys when fast EMA is above slow EMA, MACD line crosses above signal line, and ATR shows sufficient volatility. Sells when MACD crosses below signal or trend reverses.
 * When it does NOT work: Suffers in prolonged sideways chop or sudden sharp reversals where MACD gives false breakouts.
 */

function onUpdate(ctx) {
  // Require at least 50 bars for EMA and MACD warm-up
  if (ctx.i < 50) return null;

  const fastEma = ctx.ema(20, 1);
  const slowEma = ctx.ema(50, 1);
  const macdPrev = ctx.macd(12, 26, 9, 2);
  const macdCurr = ctx.macd(12, 26, 9, 1);
  const atr = ctx.atr(14, 1);
  const price = ctx.price;

  if (!fastEma || !slowEma || !macdPrev || !macdCurr || !atr || !macdPrev.macd || !macdPrev.signal || !macdCurr.macd || !macdCurr.signal) {
    return null;
  }

  // Volatility filter: ATR must be at least 0.5% of price to avoid low-volatility chop
  const minAtr = price * 0.005;
  if (atr < minAtr) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'Waiting for volatility expansion' }]);
    return null;
  }

  const isBullishTrend = fastEma > slowEma;
  const bullishCross = macdPrev.macd <= macdPrev.signal && macdCurr.macd > macdCurr.signal;
  const bearishCross = macdPrev.macd >= macdPrev.signal && macdCurr.macd < macdCurr.signal;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'MACD bullish crossover with EMA alignment', conds: [
      { label: 'Fast EMA > Slow EMA', ok: isBullishTrend },
      { label: 'MACD crossover', ok: bullishCross }
    ]}
  ]);

  if (ctx.position <= 0 && isBullishTrend && bullishCross) {
    const qty = (ctx.cash * 0.98) / price;
    return { side: 'buy', qty: qty };
  }

  if (ctx.position > 0 && bearishCross) {
    return { side: 'sell', qty: ctx.position };
  }

  return null;
}
