/*
 * @coinsori-strategy v1
 * name: BtcVixRegimeTrend1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Bet: when BTC is above its long-term average it is in an uptrend; a hard stop caps the downside.
 * Buy when price is above the 100-day average, sell when it drops back under the average or a 3x ATR
 * stop is hit. Position size risks only 2% of equity per trade.
 * Does not work in a choppy sideways market where price whipsaws across the 100-day average repeatedly.
 */
function onUpdate(ctx) {
  const vix = ctx.data('base_vix');
  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) return null;    // warm-up guard
  const price = ctx.closes.at(-1);
  const prev = ctx.closes.at(-2);
  if (price == null || prev == null) return null;

  if (ctx.position > 0) {
    const stop = (ctx.entryPx == null) ? prev - 3 * atr : ctx.entryPx - 3 * atr;
    const trendBreak = prev < sma100;
    if (price <= stop || trendBreak) {
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '3x ATR stop' },
              { side: 'sell', price: sma100, trigger: 'below', note: 'trend break' }]);
    return null;
  }

  if (vix != null) {
    ctx.state.vixHist = ctx.state.vixHist || [];
    ctx.state.vixHist.push(vix);
    if (ctx.state.vixHist.length > 60) ctx.state.vixHist.shift();
    const vixMean = ctx.state.vixHist.reduce((a, b) => a + b, 0) / ctx.state.vixHist.length;
    if (vix > vixMean + 8) return null;              // panic VIX spike -> stay out (risk-off)
  }

  if (prev > sma100) {
    const qty = Math.min((ctx.cash * 0.02) / (3 * atr), (ctx.cash / price) * 0.98); // risk 2% of equity
    ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: 'above SMA100' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: 'above SMA100' }]);
  return null;
}
