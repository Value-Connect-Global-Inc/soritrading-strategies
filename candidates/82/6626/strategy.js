/*
 * @coinsori-strategy v1
 * name: SOL 4h NDX Risk-On Trend
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Solana rallies when US equity risk appetite is on — the NASDAQ-100 above its own
 * recent mean — while the price trend is up. This tests whether the proven BTC/ETH risk-on trend edge
 * generalizes to a higher-beta altcoin with even bigger swings.
 * When it buys: EMA50 above EMA200 (uptrend) AND NDX above its own 60-day mean (risk-on).
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: in choppy ranges where the trend and the NDX signal flicker it enters more
 * often and pays more fees; it is long-only, so a sustained bear market with a weak NDX keeps it mostly
 * in cash (which protects the account but misses any counter-trend bounce). High-beta alts like SOL can
 * gap through the hard stop in a crash.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const ndx = ctx.data('base_ndx');
  if (ndx == null) return null;

  // rolling ~60-day history of the NDX index (daily series, same value repeats for 6 bars on 4h)
  let nHist = ctx.state.nHist || [];
  const nLast = nHist.length ? nHist[nHist.length - 1] : null;
  if (nLast === null || Math.abs(nLast - ndx) > 1e-9) {
    nHist = nHist.concat([ndx]);
    if (nHist.length > 60) nHist = nHist.slice(-60);
    ctx.state.nHist = nHist;
  }
  if (nHist.length < 40) return null; // need ~40 daily values for a stable mean
  const nMean = nHist.reduce((a, b) => a + b, 0) / nHist.length;
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
  // enter on equity risk-on inside an uptrend
  if (up && riskOn) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
