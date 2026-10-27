/*
 * @coinsori-strategy v1
 * name: BTC OBV Regime-Exit Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the validated BTC OBV volume-flow trend (champion 5606)
 * with one regime-conditional change to the exit. On-Balance Volume tracks
 * money flow; a rising 30-day OBV with price above the 200-day average marks
 * an accumulation-driven uptrend. In a STRONG established uptrend (price 25%
 * or more above the 200-day average) short OBV dips are normal noise, so the
 * position is held until the trend itself breaks, giving back less of a
 * melt-up; in weak trends the OBV-falling exit is kept to cut losses early.
 * When it buys and sells: buys when OBV(30) is rising AND price > SMA200 AND
 * volume > 30-day average. Exits when OBV turns down (weak trend) or when
 * price breaks the SMA200 (strong trend).
 * When it does NOT work: in choppy sideways markets OBV diverges from price
 * and whipsaws; the strong-trend hold can give back gains when a melt-up
 * reverses sharply before reaching the 200-day average.
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

  // Strong trend = price at least 25% above the 200-day average (established melt-up).
  const strongTrend = price > sma200 * 1.25;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'OBV flip exit', conds: [{ label: 'OBV(30) falling', ok: falling }] }
    ]);
    // Strong trend: OBV dips are noise — only the trend break exits.
    // Weak trend: OBV falling exits early to cut losses.
    const exitNow = strongTrend ? (price < sma200) : falling;
    if (exitNow && cd === 0) {
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
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
