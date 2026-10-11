/*
 * @coinsori-strategy v1
 * name: BbVolBreakoutStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong upward momentum when price breaks out of upper Bollinger Band accompanied by a volume surge and bullish MACD.
 * When it buys and sells: Buys when price closes above upper BB, volume is above its 20-period average, and MACD shows positive momentum. Sells when price falls below the middle BB (SMA 20) or hits trailing ATR stop.
 * When it does NOT work: Suffers in choppy, sideways markets with frequent false breakouts and high whipsaw losses.
 */

function onUpdate(ctx) {
  // Need at least 30 bars for indicators
  if (ctx.i < 30) return null;

  const close = ctx.price;
  const sma20 = ctx.sma(20, 1);
  const bb = ctx.bb(20, 2, 1);
  const macd = ctx.macd(12, 26, 9, 1);
  const macdPrev = ctx.macd(12, 26, 9, 2);
  const avgVol = ctx.avgVol(20);
  const currentVol = ctx.vol;
  const atr = ctx.atr(14, 1);

  if (sma20 == null || bb == null || macd == null || macdPrev == null || avgVol == null || atr == null) {
    return null;
  }

  const pos = ctx.position;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: bb.upper, trigger: 'above', note: 'BB Upper Breakout', conds: [
      { label: 'Vol > 1.2x Avg', ok: currentVol > avgVol * 1.2 },
      { label: 'MACD Bullish', ok: macd.macd > macd.signal }
    ]},
    { side: 'sell', price: sma20, trigger: 'below', note: 'SMA20 Exit' }
  ]);

  // Entry: Long when price breaks above upper BB, volume surges, and MACD is bullish
  if (pos === 0) {
    const isBreakout = close > bb.upper;
    const isVolumeSurge = currentVol > avgVol * 1.2;
    const isMacdBullish = macd.macd > macd.signal && macd.macd > macdPrev.macd;

    if (isBreakout && isVolumeSurge && isMacdBullish) {
      const qty = (ctx.cash / close) * 0.99;
      return { side: 'buy', qty: qty };
    }
  }

  // Exit: Close position if price crosses below middle BB (SMA 20)
  if (pos > 0) {
    if (close < sma20) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
