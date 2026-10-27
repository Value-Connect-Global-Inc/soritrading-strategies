/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + Trailing Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the validated OBV volume-flow trend engine (BTC 1d) with
 * one addition — a -25% trailing stop from the highest price since entry, to
 * cap the deep drawdowns the pure engine suffers in trend reversals (MDD up to
 * 47% on the 2017-19 window). The OBV-flip exit stays as the primary exit.
 * When it buys and sells: same entry as the champion (rising OBV + price above
 * 200d average + volume confirmation); exits when smoothed OBV turns down, or
 * when price falls 25% from its peak since entry.
 * When it does NOT work: same whipsaw as the champion in sideways markets; and
 * in a strong bull with >25% pullbacks the trailing stop cuts winners early.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) return null;

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 31];

  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    // Track the highest price since entry (restart-safe in ctx.state).
    const peak = st.peak == null || price > st.peak ? price : st.peak;
    st.peak = peak;
    const trailStop = peak * 0.75;
    ctx.watch([
      { side:'sell', price: trailStop, trigger:'below', note:'trailing -25%' }
    ]);
    // Trailing stop first: cap drawdown from the peak.
    if (price <= trailStop) {
      ctx.state.cd = 5;
      return { side:'sell', qty:pos, reduceOnly:true };
    }
    // Primary exit: OBV flow turns down.
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side:'sell', qty:pos, reduceOnly:true };
    }
    return null;
  }

  st.peak = null;
  if (rising && price > sma200 && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side:'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
