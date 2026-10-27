/*
 * @coinsori-strategy v1
 * name: BTC OBV OnChain HardStop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The on-chain-gated OBV trend was the strongest validated BTC
 * idea in this job's ledger — it beat the pure OBV champion on the two most recent
 * 1d windows (+41.6% vs +34.7%, +35.5% vs +31.6%). This version keeps that exact
 * validated engine and adds one regime-survival layer: a hard stop-loss. The OBV
 * exit alone can lag a fast crash by days because it smooths 30 days of volume
 * flow, so a fixed -25% stop caps the damage of a V-shaped meltdown before the
 * flow signal catches up.
 * When it buys and sells: Buys when smoothed OBV is clearly rising vs 30 bars ago
 * AND price is above the 200d average AND volume is above its 30d average AND
 * on-chain active addresses are above their 30d average. Sells when OBV turns down,
 * or immediately if price falls 25% below the entry price (hard stop).
 * When it does NOT work: Same whipsaw as any trend follower in sideways markets;
 * the hard stop turns a -25% paper drawdown into a realized loss and can lock in
 * losses right before a rebound. The on-chain gate adds delay when addresses are flat.
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

  // Recompute OBV over available history (deterministic, matches the champion).
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
    const entry = ctx.entryPx;
    // Hard stop: cap a single position loss at 25% — wider than normal bull
    // pullbacks but much tighter than a crash, so it only fires on real breaks.
    const stopPx = (entry != null && Number.isFinite(entry) && entry > 0) ? entry * 0.75 : null;
    const watchArr = [{ side: 'sell', note: 'OBV down' }];
    if (stopPx != null) {
      watchArr.unshift({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop -25%' });
    }
    ctx.watch(watchArr);

    if (stopPx != null && price <= stopPx) {
      st.cd = 5;
      ctx.state = st;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (falling && cd === 0) {
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
