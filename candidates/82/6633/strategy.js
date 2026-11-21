/*
 * @coinsori-strategy v1
 * name: ETH 4h VIX-Regime Trend
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Ethereum rallies when markets are calm and gets hit when fear spikes. The VIX
 * (CBOE volatility index) below its own recent mean marks a calm, risk-on regime. This tests whether
 * the VIX regime gate — which beat buy-and-hold on BTC 4h — also generalizes to ETH, which has higher
 * beta and bigger swings.
 * When it buys: EMA50 above EMA200 (uptrend) AND VIX below its own ~60-day mean (calm regime).
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: VIX is slow (2-day lag) and mean-reverting, so in a long quiet grind it sits
 * at its own mean and the gate flickers; ETH can gap through the hard stop in a crash, and in a bull
 * market that keeps climbing through rising fear it may stay in cash and miss the move.
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
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  // enter on a calm-volatility regime inside an uptrend
  if (up && calm) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
