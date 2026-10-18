/*
 * @coinsori-strategy v1
 * name: BtcVixRegimeTrend1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Bet: when US equity volatility (VIX) is calm and BTC is above its long-term average, the market is in a
 * risk-on regime where holding BTC tends to work; when VIX spikes, risk assets fall together.
 * Buy when price is above the 100-day average AND VIX is below its own 60-day average. Sell when price
 * drops back under the 100-day average, VIX jumps well above its norm, or a 2x ATR stop is hit.
 * Position size risks only 2% of equity per trade, so a string of losses cannot ruin the account.
 * Does not work in a slow grinding bear market where VIX stays low the whole way down: it just sits in
 * cash and never short-sells, missing rebounds.
 */
function onUpdate(ctx) {
  const vix = ctx.data('base_vix');
  if (vix == null) return null;                      // VIX is business-days only; no regime data -> no trade
  ctx.state.vixHist = ctx.state.vixHist || [];
  ctx.state.vixHist.push(vix);
  if (ctx.state.vixHist.length > 60) ctx.state.vixHist.shift();

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) return null;    // warm-up guard
  const price = ctx.closes.at(-1);
  const prev = ctx.closes.at(-2);
  if (price == null || prev == null) return null;

  const sum = ctx.state.vixHist.reduce((a, b) => a + b, 0);
  const vixMean = sum / ctx.state.vixHist.length;

  if (ctx.position > 0) {
    const stop = (ctx.entryPx == null) ? prev - 2 * atr : ctx.entryPx - 2 * atr;
    const trendBreak = prev < sma100;
    const vixSpike = vix > vixMean + 5;               // VIX well above its norm = risk-off, get out
    if (price <= stop || trendBreak || vixSpike) {
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
              { side: 'sell', price: sma100, trigger: 'below', note: 'trend break' }]);
    return null;
  }

  if (prev > sma100 && vix < vixMean) {               // uptrend + calm vol = risk-on entry
    const qty = Math.min((ctx.cash * 0.02) / (2 * atr), (ctx.cash / price) * 0.98); // risk 2% of equity
    ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: 'above SMA100 + calm VIX' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: 'above SMA100 + calm VIX' }]);
  return null;
}
