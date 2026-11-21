/*
 * @coinsori-strategy v1
 * name: BTC 4h NDX Long-Short
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 * marketType: usdm
 *
 * Why this strategy: Bitcoin trades with global risk appetite AND can be shorted on perpetuals.
 * When the NASDAQ-100 is above its own recent mean (risk-on) and BTC is trending up, we go long;
 * when NDX is below its mean (risk-off) and BTC is trending down, we go SHORT — capturing the
 * bear periods that a long-only strategy must sit through.
 * When it buys: EMA50 above EMA200 AND NDX above its own 60-day mean -> long.
 * When it sells (short): EMA50 below EMA200 AND NDX below its own 60-day mean -> short.
 * When it exits: the trend/regime condition flips, or a -20% stop (long) / +20% stop (short).
 * When it does NOT work: when NDX and BTC disagree (e.g. NDX risk-off but BTC pumping) it sits
 * flat and misses the move; funding costs on the short side erode returns in long sideways
 * markets; the regime gate can flip right at a bottom and turn a short into a whipsaw.
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
  const riskOn = ndx > nMean;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position != 0;
  const longStop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const shortStop = ctx.entryPx != null ? ctx.entryPx * 1.2 : Infinity;

  const wantLong = up && riskOn;
  const wantShort = !up && !riskOn;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'long: uptrend + risk-on', conds:[
      { label:'NDX>own mean', ok: riskOn }
    ]},
    { side:'sell', price: e200, trigger:'below', note:'short: downtrend + risk-off', conds:[
      { label:'NDX<own mean', ok: !riskOn }
    ]},
    ...(inPos ? [
      { side:'sell', price: longStop, trigger:'below', note:'long stop' },
      { side:'buy', price: shortStop, trigger:'above', note:'short stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (ctx.position > 0) {
      if (price <= longStop) return { side:'sell', qty: ctx.position, reduceOnly: true };
      if (!wantLong) return { side:'sell', qty: ctx.position, reduceOnly: true };
    } else {
      if (price >= shortStop) return { side:'buy', qty: -ctx.position, reduceOnly: true };
      if (!wantShort) return { side:'buy', qty: -ctx.position, reduceOnly: true };
    }
    return null;
  }
  if (wantLong) return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  if (wantShort) return { side:'sell', qty: (ctx.cash / price) * 0.99 };
  return null;
}
