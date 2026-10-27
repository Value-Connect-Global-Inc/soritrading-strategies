/*
 * @coinsori-strategy v1
 * name: BTC Fast OBV Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the validated OBV champion (slow, SMA200-gated) protects in
 * bears but lags violent melt-ups because its 200-day gate is slow to enter.
 * This variant uses a faster 50-day gate and a 10-bar OBV comparison so it
 * catches the early part of a bull run, at the cost of more whipsaw in chop.
 * When it buys and sells: buys when OBV rises over 10 bars AND price above its
 * 50-day average AND today's volume above its 20-day average; sells when OBV
 * falls over 10 bars or price closes below the 50-day average.
 * When it does NOT work: in choppy sideways markets the faster gate whipsaws
 * and fees erode returns; it still lags sharp V-shaped reversals like all
 * trend signals.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 12) return null;

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v; else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 12) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 11];

  const rising = obvNow > obvPast * 1.005;
  const falling = obvNow < obvPast * 0.995;

  const avgV = ctx.avgVol(20);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  const pos = ctx.position;
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'OBV(10) flip exit', conds: [{ label: 'OBV(10) falling', ok: falling }] }
    ]);
    if (falling && cd === 0) {
      ctx.state.cd = 3;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (price < sma50) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'fast OBV entry', conds: [
      { label: 'OBV(10) rising', ok: rising },
      { label: 'Price > SMA50', ok: price > sma50 },
      { label: 'Volume > avg20', ok: volOk }
    ]}
  ]);
  if (rising && price > sma50 && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 3;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
