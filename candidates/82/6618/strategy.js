/*
 * @coinsori-strategy v1
 * name: ETH 4h NDX Risk-On Trend
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Ethereum trades as a risk asset alongside US equities, with even higher
 * beta to risk appetite than Bitcoin. When the NASDAQ-100 index is running ABOVE its own recent
 * average, global risk appetite is on and ETH uptrends are more likely to extend. Same proven
 * mechanism as the BTC champion, applied to the higher-beta asset.
 * When it buys: EMA50 above EMA200 (uptrend) AND NDX above its own 60-day mean (risk-on).
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: in a choppy range where NDX hovers around its mean the gate flickers;
 * ETH is more volatile than BTC so the -20% stop is hit more often in sharp shakeouts; in a
 * crypto-specific pump with flat equities it stays out and misses upside.
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
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + NDX risk-on', conds:[
      { label:'NDX>own mean', ok: riskOn }
    ]},
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
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
