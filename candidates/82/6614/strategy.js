/*
 * @coinsori-strategy v1
 * name: BTC 4h NDX Risk-On Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades as a risk asset alongside US equities. When the NASDAQ-100
 * index is running ABOVE its own recent average, global risk appetite is on and BTC uptrends are
 * more likely to extend. We use NDX relative to its own ~60-day mean (not a fixed level) so the
 * filter stays valid across bull and bear equity regimes. Unlike a fear gauge (VIX) or a rates
 * level, an equity index stays HIGH through bull markets, so it does not block BTC rallies.
 * When it buys: EMA50 above EMA200 (uptrend) AND NDX above its own 60-day mean (risk-on).
 * When it sells: the trend breaks, a -20% hard stop below entry, OR a trailing stop 15% below
 * the highest price since entry (so a sharp crash is cut near the peak, not down to -20%).
 * When it does NOT work: in a choppy range where NDX hovers around its mean the gate flickers;
 * in a crypto-specific pump with flat equities it stays out and misses upside; the trailing stop
 * can be shaken out by a sharp intra-trend pullback that later resumes.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const ndx = ctx.data('base_ndx');
  if (ndx == null) return null;

  // rolling ~60-day history of the NDX index (daily series, same value repeats for 6 bars on 4h)
  let hist = ctx.state.nHist || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (last === null || Math.abs(last - ndx) > 1e-9) {
    hist = hist.concat([ndx]);
    if (hist.length > 60) hist = hist.slice(-60);
    ctx.state.nHist = hist;
  }
  if (hist.length < 40) return null; // need ~40 daily values for a stable mean
  const nMean = hist.reduce((a, b) => a + b, 0) / hist.length;
  // risk-on = NDX above its own recent mean
  const riskOn = ndx > nMean;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;

  // trailing high since entry (survives restarts via ctx.state)
  let hi = ctx.state.hi;
  if (inPos) {
    if (hi == null) hi = ctx.entryPx != null ? ctx.entryPx : price;
    if (price > hi) hi = price;
    ctx.state.hi = hi;
  } else {
    ctx.state.hi = null;
  }

  // stop = the higher of the -20% hard stop and the 15%-below-peak trailing stop
  const hardStop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const trailStop = hi != null && hi > 0 ? hi * 0.85 : 0;
  const stop = Math.max(hardStop, trailStop);

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + NDX risk-on', conds:[
      { label:'NDX>own mean', ok: riskOn }
    ]},
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard/trail stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (up && riskOn) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
