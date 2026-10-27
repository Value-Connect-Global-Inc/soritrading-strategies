/*
 * @coinsori-strategy v1
 * name: BTC OBV Champion Pure 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The pure OBV money-flow trend champion from the ledger, saved
 * as a separate strategy to run head-to-head against the on-chain-gated version on
 * identical windows. Rising smoothed OBV + price above 200d + volume confirmation
 * = accumulation-driven uptrend.
 * When it buys and sells: Buys when smoothed OBV is clearly rising vs 30 bars ago
 * AND price is above the 200d average AND today's volume is above its 30d average.
 * Sells when smoothed OBV turns down. Hysteresis + cooldown reduce churn.
 * When it does NOT work: Same whipsaw as any trend follower in sideways markets.
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

  const st = ctx.state || {};
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;
  ctx.state = st;

  if (pos > 0) {
    if (falling && cd === 0) {
      st.cd = 5;
      ctx.state = st;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (rising && price > sma200 && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    st.cd = 5;
    ctx.state = st;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
