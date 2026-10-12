/*
 * @coinsori-strategy v1
 * name: OBV Trend + On-Chain Demand De-Risk BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV volume-flow trend family captures bull momentum
 * (champion returns) but carries high drawdown in sharp bear reversals because
 * OBV turns late. On-chain active-address demand is a validated DEFENSIVE signal
 * that leads price in capitulation. This hybrid keeps the OBV trend for returns
 * but overlays an on-chain demand filter: when network demand is contracting we
 * force an exit and block re-entry, cutting the bear drawdown the pure OBV family
 * cannot fix with price-based exits.
 * When it buys and sells: buys when 30-day OBV is rising AND price is above the
 * 100-day average AND volume confirms, AND network demand is not contracting.
 * Sells when OBV turns down OR network demand contracts (either signal).
 * When it does NOT work: on-chain data is daily and lags fast V-shaped recoveries,
 * so it may stay out of the very first days of a relief rally after a demand
 * contraction; and in a melt-up where both OBV and demand rise it behaves like
 * the pure OBV trend (high drawdown remains in the sharpest reversals).
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) {
    ctx.watch([]);
    return null;
  }

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) {
    ctx.watch([]);
    return null;
  }
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 31];
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  // On-chain demand filter: addr_sma30 contracting vs ~30 bars ago => force exit + block buys.
  const addr = Number(ctx.data('addr_sma30'));
  let demandOk = true;
  if (Number.isFinite(addr) && addr > 0) {
    const st = ctx.state;
    if (!st.aHist) st.aHist = [];
    st.aHist.push(addr);
    if (st.aHist.length > 30) st.aHist.shift();
    if (st.aHist.length >= 30) {
      const aPast = st.aHist[0];
      demandOk = addr >= aPast * 0.99; // not contracting
    }
  }

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      note: 'OBV/demand exit',
      conds: [
        { label: 'OBV 30d falling', ok: falling },
        { label: 'Demand contracting', ok: !demandOk }
      ]
    }]);
    if (falling || !demandOk) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'OBV+demand entry',
    conds: [
      { label: 'OBV 30d rising', ok: rising },
      { label: 'Volume > avg30', ok: volOk },
      { label: 'Demand not contracting', ok: demandOk }
    ]
  }]);

  if (rising && price > sma100 && volOk && demandOk) {
    const qty = ctx.cash / price * 0.95;
    return { side: 'buy', qty: qty };
  }
  return null;
}
