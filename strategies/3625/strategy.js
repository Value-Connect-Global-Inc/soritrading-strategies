/*
 * @coinsori-strategy v1
 * name: ETH Dollar-Regime Trend 4H v3
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: buy 20-bar breakouts in an uptrend, but only when the US
 *   dollar is not strengthening and volatility is expanding. A rising dollar
 *   pulls money out of crypto, and breakouts in a low-volatility regime are
 *   mostly false moves, so both conditions gate the entry.
 * When it buys and sells: buy on a fresh 20-bar high close above the 100-EMA
 *   with above-average volume, while DXY is below its 30-day average and ATR is
 *   above its 60-bar average. Sell on a 20-bar low close, a 2.5x ATR disaster
 *   stop, a close back below the 100-EMA, or a profit-protection trailing stop
 *   that locks in gains once the trade is 2x ATR in profit.
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
  const dxyOk = hist.length >= 31;
  const dxyAvg = dxyOk ? hist.slice(-30).reduce((a, b) => a + b, 0) / 30 : null;
  const dollarRising = dxyAvg != null && dxy != null && dxy > dxyAvg;

  // rolling ATR history to detect volatility regime (expanding vol = real breakouts)
  let atrHist = ctx.state.atrHist || [];
  atrHist.push(atr);
  if (atrHist.length > 65) atrHist = atrHist.slice(-65);
  ctx.state.atrHist = atrHist;
  const atrOk = atrHist.length >= 61;
  const atrAvg = atrOk ? atrHist.slice(-60).reduce((a, b) => a + b, 0) / 60 : null;
  const volExpanding = atrAvg != null && atr > atrAvg;

  if (ctx.position > 0) {
    // profit-protection trail: only after 2x ATR in profit, ratchet a stop 1.5x ATR below price
    let trail = typeof ctx.state.trail === 'number' ? ctx.state.trail : 0;
    const profit = price - ctx.entryPx;
    if (profit > 2 * atr) {
      const newTrail = price - 1.5 * atr;
      if (newTrail > trail) trail = newTrail;
    }
    ctx.state.trail = trail;
    const hardStop = ctx.entryPx - 2.5 * atr;
    const stop = Math.max(hardStop, trail);
    const ll20 = ctx.low(20, 2);
    if (price <= stop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema100) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trail/disaster stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  ctx.state.trail = 0;   // reset trail for the next entry
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
