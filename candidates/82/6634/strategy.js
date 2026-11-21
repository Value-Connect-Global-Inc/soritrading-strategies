/*
 * @coinsori-strategy v1
 * name: BTC 4h VIX-Regime Trend + Fear Exit
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The auto-promoted VIX-Regime Trend only GATES entries with the VIX (calm = risk-on)
 * and exits only on trend break / hard stop. This variant also EXITS when the VIX spikes above its own
 * mean while holding — if calm VIX is required to enter, a fear spike while holding should be a reason
 * to leave too. Tests whether the gate adds protection on the exit side as well as the entry side.
 * When it buys: EMA50 above EMA200 (uptrend) AND VIX below its own ~60-day mean (calm regime).
 * When it sells: the EMA50/200 trend breaks, a -20% hard stop below entry, OR the VIX rises above its
 * own ~60-day mean (fear spike).
 * When it does NOT work: VIX spikes are often sharp but short — a fear exit can sell right at the
 * bottom of a panic and miss the immediate rebound that the trend-only version would have ridden.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const vix = ctx.data('base_vix'); // CBOE volatility index
  if (vix == null) return null;

  // rolling ~60-day history of the daily VIX (same value repeats for 6 bars on 4h)
  let vHist = ctx.state.vHist || [];
  const vLast = vHist.length ? vHist[vHist.length - 1] : null;
  if (vLast === null || Math.abs(vLast - vix) > 1e-9) {
    vHist = vHist.concat([vix]);
    if (vHist.length > 60) vHist = vHist.slice(-60);
    ctx.state.vHist = vHist;
  }
  if (vHist.length < 40) return null; // need ~40 daily values for a stable mean
  const vMean = vHist.reduce((a, b) => a + b, 0) / vHist.length;
  const calm = vix < vMean; // low VIX = calm = risk-on
  const fear = vix > vMean; // high VIX = fear = risk-off

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + calm VIX', conds:[
      { label:'VIX<own mean', ok: calm }
    ]},
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' },
      { side:'sell', price: price, trigger:'below', note:'VIX fear spike', conds:[
        { label:'VIX>own mean', ok: fear }
      ]}
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (fear) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  // enter on a calm-volatility regime inside an uptrend
  if (up && calm) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
