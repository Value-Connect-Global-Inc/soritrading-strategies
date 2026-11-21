/*
 * @coinsori-strategy v1
 * name: BTC 4h Funding Squeeze Ride
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On Bitcoin perpetual futures the funding rate is the price longs pay shorts
 * every 8h. Extremely NEGATIVE funding means shorts are crowded and paying to stay short — that
 * crowded positioning historically fuels a squeeze back up. We use funding ONLY as the entry
 * trigger (crowded shorts), then let the trend control the exit so winners are not cut short by
 * funding mean-reverting a few bars later.
 * When it buys: funding z-score < -1.5 (unusually crowded shorts) AND EMA50 above EMA200 (uptrend).
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: in a strong bear market funding can stay negative for a long stretch
 * while price keeps falling (the trend filter helps but does not eliminate it); in a flat range
 * signals are rare so the strategy sits in cash for long periods.
 */
function onUpdate(ctx) {
  const f = ctx.funding;
  if (f == null) return null;
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;

  // rolling funding history; funding changes ~every 8h = every 2 bars on 4h, so dedup consecutive values
  let hist = ctx.state.fHist || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (last === null || Math.abs(last - f) > 1e-12) {
    hist = hist.concat([f]);
    if (hist.length > 90) hist = hist.slice(-90); // ~30 days of funding samples
    ctx.state.fHist = hist;
  }
  if (hist.length < 30) return null; // need ~30 samples for a stable mean/std
  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  let sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
  if (!(sd > 0)) return null;
  const z = (f - mean) / sd;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  // entry only: crowded shorts (z < -1.5) + uptrend
  const buySignal = up && z < -1.5;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'short squeeze + uptrend', conds:[
      { label:'funding z', now: z, op:'<', ref: -1.5, closed:true }
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
  if (buySignal) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
