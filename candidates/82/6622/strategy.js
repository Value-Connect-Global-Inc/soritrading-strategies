/*
 * @coinsori-strategy v1
 * name: BTC 4h NDX Risk-On/Off Long-Short v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin follows US equity risk appetite in BOTH directions, but the long-only
 * champion (NDX risk-on trend) sits in cash through bear markets. The first long/short version lost
 * badly in the 2022 bear because crypto's violent +30% rallies whipsawed the shorts. This v2 keeps the
 * long side identical to the champion and makes shorts far more selective: it only shorts after a
 * confirmed breakdown (price below the 200-EMA AND falling 20-bar momentum AND NDX below its mean) and
 * covers fast when price reclaims the 50-EMA, instead of waiting for the slow trend flip.
 * When it buys: EMA50 above EMA200 AND NDX above its own mean (long). It sells short only on a
 * confirmed breakdown with risk-off equity. It exits longs on a trend break or -20% stop; exits shorts
 * on a fast reclaim of the 50-EMA or a -20% stop.
 * When it does NOT work: in choppy ranges the trend and NDX signals flicker and it pays more fees; and
 * crypto shorts can still be squeezed violently, so a -20% stop is mandatory — a gap through the stop
 * still loses.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const ndx = ctx.data('base_ndx');
  if (ndx == null) return null;

  // rolling ~60-day history of the NDX index (daily series, repeats for 6 bars on 4h)
  let nHist = ctx.state.nHist || [];
  const nLast = nHist.length ? nHist[nHist.length - 1] : null;
  if (nLast === null || Math.abs(nLast - ndx) > 1e-9) {
    nHist = nHist.concat([ndx]);
    if (nHist.length > 60) nHist = nHist.slice(-60);
    ctx.state.nHist = nHist;
  }
  if (nHist.length < 40) return null;
  const nMean = nHist.reduce((a, b) => a + b, 0) / nHist.length;
  const riskOn = ndx > nMean;

  const price = ctx.price;
  const up = e50 > e200;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const mom20 = ctx.change(20, 1); // 20-bar (~3.3 day) momentum, closed bar

  // -20% hard stop both ways: caps any single-trade loss (champion's proven choice)
  const longStop = entry != null ? entry * 0.8 : 0;
  const shortStop = entry != null ? entry * 1.2 : 0;

  const watchList = [];
  if (pos === 0) {
    watchList.push({ side:'buy', price: e200, trigger:'above', note:'uptrend + NDX risk-on', conds:[{label:'NDX>own mean', ok: riskOn}] });
    watchList.push({ side:'sell', price: e200, trigger:'below', note:'breakdown + NDX risk-off', conds:[{label:'NDX<own mean', ok: !riskOn},{label:'mom20<0', ok: mom20 != null && mom20 < 0}] });
  } else if (pos > 0) {
    watchList.push({ side:'sell', price: e200, trigger:'below', note:'trend broke' });
    watchList.push({ side:'sell', price: longStop, trigger:'below', note:'hard stop' });
  } else {
    watchList.push({ side:'buy', price: e50, trigger:'above', note:'reclaim 50-EMA' });
    watchList.push({ side:'buy', price: shortStop, trigger:'above', note:'hard stop' });
  }
  ctx.watch(watchList);

  if (pos > 0 && entry != null) {
    if (price <= longStop || !up) return { side:'sell', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }
  if (pos < 0 && entry != null) {
    // cover fast on a short-term reclaim — do not wait for the slow trend flip (v1 whipsaw lesson)
    if (price >= shortStop || price > e50) return { side:'buy', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }
  if (pos === 0) {
    if (up && riskOn) return { side:'buy', qty: (ctx.cash / price) * 0.99 };
    // short ONLY on a confirmed breakdown: trend down + price below the 200-EMA + falling momentum + risk-off.
    // This avoids shorting into strength / fresh bounces, which is what killed v1.
    if (!up && price < e200 && mom20 != null && mom20 < 0 && !riskOn) {
      return { side:'sell', qty: (ctx.cash / price) * 0.99 };
    }
  }
  return null;
}
