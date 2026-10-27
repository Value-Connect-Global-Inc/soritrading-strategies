/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + SMA200 Exit 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the proven OBV volume-flow trend finds BTC accumulation-
 * driven uptrends, but its OBV-flip exit lags in crashes (47% MDD in 2017-20).
 * The champion displays an SMA200-break exit but never acts on it. This variant
 * actually exits when price closes below its 200-day average — a slower, more
 * robust trend-break signal that catches crashes earlier than OBV flip alone.
 * When it buys and sells: same OBV entries as the champion; now exits on EITHER
 * OBV flip OR price closing below SMA200. SMA200 break = long-term trend broken.
 * When it does NOT work: in a V-shaped recovery price may close below SMA200 at
 * the very bottom and you sell near the low, missing the rebound.
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
    const below200 = price < sma200;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 close break', conds: [{ label: 'SMA200', now: sma200, op: '>', ref: price, closed: true }] },
      { side: 'sell', price: price, trigger: 'below', note: 'OBV flip exit', conds: [{ label: 'OBV(30) falling', ok: falling }] }
    ]);
    if (((below200 || falling)) && cd === 0) {
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
