/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + Bull Hold 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-Balance Volume tracks whether money flows in or out.
 * It avoids bear markets (2018, 2022) by exiting when volume flow turns down,
 * but this same rule cuts winners short in strong bull rallies.
 * When it buys and sells: buys when smoothed OBV is rising, price above its
 * 200-day average and volume confirms. In a deep bull (price >25% above the
 * 200-day) it holds through OBV dips and only exits on a trend break or a
 * trailing stop, so it keeps more of the rally. In a normal regime it exits on
 * the OBV flip as before.
 * When it does NOT work: in choppy sideways markets OBV whipsaws; a deep-bull
 * trailing stop still gives back part of a sharp V-shaped top.
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

  // Deep-bull regime: price more than 25% above the 200-day average.
  const deepBull = price > sma200 * 1.25;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    if (price > (st.peak || price)) st.peak = price;
    if (deepBull) {
      // In a deep bull: hold through OBV dips, exit on trend break or 20% trailing stop.
      const trail = (st.peak || price) * 0.80;
      if (price < sma200 || price < trail) {
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
      return null;
    }
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (rising && price > sma200 && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    st.peak = price;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
