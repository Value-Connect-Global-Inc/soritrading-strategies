/*
 * @coinsori-strategy v1
 * name: BTC 4h Rates Easing Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a long-duration risk asset — when the 10-year Treasury
 * yield is FALLING relative to its own recent average, financial conditions are easing and risk
 * assets (including BTC) tend to be supported. We use the CHANGE in the 10Y yield vs its own
 * ~60-day mean (not a fixed level), so the filter stays valid across different rate regimes.
 * When it buys: EMA50 above EMA200 (uptrend) AND the 10Y yield is below its own 60-day mean
 * (yields easing = risk-on).
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: in a choppy range where yields hover around their mean the gate flickers;
 * in a liquidity-driven BTC pump with flat yields it stays out and misses upside; the hard stop
 * can be hit by a sharp intra-trend shakeout.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const y = ctx.data('base_ust10y');
  if (y == null) return null;

  // rolling ~60-day history of the 10Y yield (daily series, same value repeats for 6 bars on 4h)
  let hist = ctx.state.yHist || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (last === null || Math.abs(last - y) > 1e-9) {
    hist = hist.concat([y]);
    if (hist.length > 60) hist = hist.slice(-60);
    ctx.state.yHist = hist;
  }
  if (hist.length < 40) return null; // need ~40 daily values for a stable mean
  const yMean = hist.reduce((a, b) => a + b, 0) / hist.length;
  // easing = current yield below its own recent mean
  const easing = y < yMean;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + yields easing', conds:[
      { label:'10Y<own mean', ok: easing }
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
  if (up && easing) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
