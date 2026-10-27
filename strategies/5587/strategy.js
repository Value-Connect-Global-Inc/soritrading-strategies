/*
 * @coinsori-strategy v1
 * name: BTC OBV OnChain-Gated 1D v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: OBV money-flow trend was the strongest validated BTC 1d idea
 * in this job's ledger (W2 2017-22 +707% vs hold +386%, W3 2021-26 +131% vs hold
 * +51%). This version keeps that proven engine and adds an on-chain gate: active
 * addresses above their 30d average, so entries are backed by real network usage.
 * When it buys and sells: Buys when smoothed OBV is clearly rising vs 30 bars ago
 * AND price above 200d average AND volume above its 30d average AND active
 * addresses above their 30d average. Sells when smoothed OBV turns down (with
 * 1% hysteresis and 5-bar cooldown).
 * When it does NOT work: Same whipsaw as any trend follower in sideways markets;
 * if addresses stay flat for long stretches the gate adds delay without benefit.
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

  // Recompute OBV over available history (deterministic, matches proven champion).
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

  // Hysteresis: 1% band so a tiny flip does not trigger a trade (cuts churn).
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  // Cooldown: after a flip, wait 5 bars before flipping again (cuts whipsaw).
  const st = ctx.state || {};
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;
  ctx.state = st;

  if (pos > 0) {
    if (falling && cd === 0) {
      ctx.watch([{ side: 'sell', note: 'OBV down' }]);
      st.cd = 5;
      ctx.state = st;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // On-chain gate: network usage must be rising (addresses above 30d average).
  const addr = ctx.data("addr");
  const addrAvg = ctx.data("addr_sma30");
  const addrOk = addr != null && addrAvg != null && addr > addrAvg;

  if (rising && price > sma200 && volOk && addrOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    st.cd = 5;
    ctx.state = st;
    ctx.watch([{ side: 'buy', note: 'OBV up, addr rising',
                 conds: [{ label: 'addr>30d avg', ok: addrOk, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
