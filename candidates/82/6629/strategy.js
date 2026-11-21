/*
 * @coinsori-strategy v1
 * name: ETH 4h Yield-Curve Regime Trend
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Ethereum rallies when the US yield curve is healthy — the 10Y-2Y spread above its
 * own recent mean — which historically marks a supportive macro regime for risk assets. This tests
 * whether the yield-curve regime gate (which beat buy-and-hold on BTC 4h) also generalizes to ETH,
 * which has higher beta and bigger swings.
 * When it buys: EMA50 above EMA200 (uptrend) AND the 10Y-2Y spread above its own 60-day mean.
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: the yield curve is slow (2-day lag) and changes rarely, so it adds little
 * timing on 4h bars and mostly mirrors the price trend. ETH can gap through the hard stop in a crash,
 * and in long inverted-curve periods while crypto still rallies on liquidity it stays in cash.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const spread = ctx.data('base_t10y2y'); // 10Y minus 2Y, % points, can be negative
  if (spread == null) return null;

  // rolling ~60-day history of the daily curve spread (same value repeats for 6 bars on 4h)
  let sHist = ctx.state.sHist || [];
  const sLast = sHist.length ? sHist[sHist.length - 1] : null;
  if (sLast === null || Math.abs(sLast - spread) > 1e-9) {
    sHist = sHist.concat([spread]);
    if (sHist.length > 60) sHist = sHist.slice(-60);
    ctx.state.sHist = sHist;
  }
  if (sHist.length < 40) return null; // need ~40 daily values for a stable mean
  const sMean = sHist.reduce((a, b) => a + b, 0) / sHist.length;
  const curveOk = spread > sMean;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + curve healthy', conds:[
      { label:'10Y2Y>own mean', ok: curveOk }
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
  // enter on a healthy yield curve inside an uptrend
  if (up && curveOk) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
