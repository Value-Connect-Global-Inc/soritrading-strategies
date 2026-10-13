/*
 * @coinsori-strategy v1
 * name: ETH Dollar-Regime Trend 4H v3 (trailing exit)
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: buy 20-bar breakouts in an uptrend, but only when the US
 *   dollar is not strengthening and volatility is expanding. A rising dollar
 *   pulls money out of crypto, and breakouts in a low-volatility regime are
 *   mostly false moves, so both conditions gate the entry. v3 changes only the
 *   exit: a chandelier trailing stop replaces the 20-bar low close exit, so
 *   winners are given room to run instead of being cut on normal pullbacks.
 * When it buys and sells: buy on a fresh 20-bar high close above the 100-EMA
 *   with above-average volume, while DXY is below its 30-day average and ATR is
 *   above its 60-bar average. Sell on a 3x ATR trailing stop below the highest
 *   close since entry, a 2.5x ATR floor stop, or a close back below the 100-EMA.
 * When it does NOT work: misses melt-ups that happen while the dollar is also
 *   firming or while volatility is still compressing, and the filters can sit
 *   out long stretches in choppy years.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // rolling DXY history (4h bars ~ 30 days at 180 bars) to judge dollar direction
  const dxy = ctx.data('dxy');
  let hist = ctx.state.dxyHist || [];
  if (dxy != null) { hist.push(dxy); if (hist.length > 210) hist = hist.slice(-210); }
  ctx.state.dxyHist = hist;
  const dxyAvg = hist.length >= 31 ? hist.slice(-30).reduce((a, b) => a + b, 0) / 30 : null;
  const dollarRising = dxyAvg != null && dxy != null && dxy > dxyAvg;

  // rolling ATR history to detect volatility regime (expanding vol = real breakouts)
  let atrHist = ctx.state.atrHist || [];
  atrHist.push(atr);
  if (atrHist.length > 65) atrHist = atrHist.slice(-65);
  ctx.state.atrHist = atrHist;
  const atrAvg = atrHist.length >= 61 ? atrHist.slice(-60).reduce((a, b) => a + b, 0) / 60 : null;
  const volExpanding = atrAvg != null && atr > atrAvg;

  if (ctx.position > 0) {
    // chandelier trailing stop: ratchet to the highest close since entry, minus 3x ATR.
    // 3x ATR gives a normal pullback room to breathe while still capping the loss.
    let hh = ctx.state.hhSinceEntry;
    if (hh == null || prevClose > hh) { hh = prevClose; ctx.state.hhSinceEntry = hh; }
    const trailStop = hh - 3 * atr;
    const floorStop = ctx.entryPx - 2.5 * atr;   // hard stop: never risk more than the 2.5x ATR entry plan
    const stop = Math.max(trailStop, floorStop);
    if (price <= stop) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema100) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'chandelier 3x ATR trailing stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }
  ctx.state.hhSinceEntry = null;

  if (dollarRising) return null;   // dollar-regime gate: no entries while DXY above its 30-day average
  if (!volExpanding) return null;  // volatility gate: skip low-vol chop where breakouts whipsaw
  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
