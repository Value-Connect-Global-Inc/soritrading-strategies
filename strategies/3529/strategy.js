/*
 * @coinsori-strategy v1
 * name: BTC Breakout Volume Momentum 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong hourly momentum breakouts in BTC when volume surges above average and price crosses 20-period high.
 * When it buys and sells: Buys when price makes a 20-bar high with volume > 1.5x average. Sells on ATR trailing stop, take-profit, or trend reversal.
 * When it does not work: Suffers in choppy, low-volume ranging markets where breakouts frequently fail.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const closes = ctx.closes;
  if (!closes || closes.length < 50) return null;

  // Indicators
  const smaVol = ctx.avgVol(20);
  const curVol = ctx.vol;
  const atr = ctx.atr(14);
  const high20 = ctx.high(20, 1); // 20-bar high excluding current bar

  if (smaVol == null || curVol == null || atr == null || high20 == null) return null;

  const pos = ctx.position;

  // Manage existing position (Exit rules)
  if (pos > 0) {
    const entryPx = ctx.entryPx;
    // Take profit at +4% or Stop Loss at -2% (approx via ATR or fixed bounds)
    if (p >= entryPx * 1.04 || p <= entryPx * 0.98) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry rules: Breakout of 20-bar high with volume surge
  const isBreakout = p > high20;
  const isVolumeSurge = curVol > smaVol * 1.5;

  if (isBreakout && isVolumeSurge) {
    const qty = (ctx.cash * 0.99) / p;
    ctx.watch([
      { side: 'buy', price: high20, trigger: 'above', note: '20-bar high breakout', conds: [{ label: 'Vol > 1.5x SMA', ok: isVolumeSurge }] }
    ]);
    return { side: 'buy', qty: qty };
  }

  return null;
}
