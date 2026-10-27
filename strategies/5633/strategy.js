/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + ATR Trail Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the proven OBV volume-flow trend finds BTC accumulation-driven
 * uptrends, but its OBV-flip exit lags in crashes (47% MDD in 2017-20). Adding a
 * hard ATR-based trailing stop caps the damage a fast crash does before OBV flips.
 * When it buys and sells: same OBV entries as the champion; now also exits on a
 * 3x ATR(14) trailing stop below the highest close since entry, in ADDITION to the
 * OBV-flip exit. The trailing stop ratchets up with the trend.
 * When it does NOT work: in a sharp crash the ATR stop triggers near the worst
 * point of a normal pullback in a strong uptrend, exiting before the trend
 * resumes — whipsaw in volatile chop.
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

  // ATR trailing stop: 3x ATR(14) below the highest close since entry, rolled on bar change.
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  // Track highest close since entry (rolled on bar change).
  if (pos > 0) {
    // trailing stop level = highest close since entry minus 3 * ATR(14)
    let hi = st.hi != null ? Math.max(st.hi, price) : price;
    if (st.lastI !== ctx.i) { st.hi = hi; st.lastI = ctx.i; }
    const stop = hi - 3 * atr;
    const stopHit = price < stop;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR trail stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'OBV flip exit', conds: [{ label: 'OBV(30) falling', ok: falling }] }
    ]);
    if (stopHit && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'OBV rising entry', conds: [
      { label: 'OBV(30) rising', ok: rising },
      { label: 'Price > SMA200', ok: price > sma200 },
      { label: 'Volume > avg30', ok: volOk }
    ]}
  ]);
  if (rising && price > sma200 && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    st.hi = price;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
