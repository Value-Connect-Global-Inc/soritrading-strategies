/*
 * @coinsori-strategy v1
 * name: BTC 1h Donchian Breakout ATR Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong continuation trends by buying breakouts of recent price highs with volume confirmation.
 * When it buys and sells: Buys when price breaks the 24-period high accompanied by above-average volume, and sells on ATR-based stop or lower channel break.
 * When it does NOT work: Choppy, sideways markets with false breakouts cause frequent small losses.
 */

function onUpdate(ctx) {
  // Need at least 30 bars for indicators
  if (ctx.i < 30) return null;

  const close = ctx.closes.at(-1);
  const prevClose = ctx.closes.at(-2);
  if (close == null || prevClose == null) return null;

  // 24-period Donchian Channel High and Low (excluding current bar)
  const high24 = ctx.high(24, 1);
  const low24 = ctx.low(24, 1);
  const sma20 = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);
  const avgVol = ctx.avgVol(20);
  
  if (high24 == null || low24 == null || sma20 == null || atr == null || avgVol == null) return null;

  const currentVol = ctx.vol;
  const inPosition = ctx.position > 0;

  // Watch conditions for live/paper display
  if (!inPosition) {
    ctx.watch([
      { side: 'buy', price: high24, trigger: 'above', note: 'Donchian High breakout', conds: [
        { label: 'Vol > 1.2 * avgVol', now: currentVol, op: '>', ref: avgVol * 1.2, closed: false },
        { label: 'Close > SMA20', now: close, op: '>', ref: sma20, closed: true }
      ]}
    ]);
  } else {
    const stopPrice = ctx.entryPx - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: stopPrice, trigger: 'below', note: 'ATR Trailing Stop' },
      { side: 'sell', price: low24, trigger: 'below', note: 'Donchian Low Exit' }
    ]);
  }

  // Exit Logic: stop loss or lower channel cross
  if (inPosition) {
    const stopLossPx = ctx.entryPx - 2.5 * atr;
    if (close <= stopLossPx || close < low24) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // Entry Logic: Breakout of 24h high with volume confirmation and above SMA20
  const volOk = currentVol > avgVol * 1.2;
  const trendOk = close > sma20;
  const breakout = close > high24;

  if (breakout && volOk && trendOk) {
    const qty = (ctx.cash / close) * 0.98;
    if (qty > 0) {
      return { side: 'buy', qty: qty };
    }
  }

  return null;
}
