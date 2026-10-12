/*
 * @coinsori-strategy v1
 * name: 45d OBV Trend BNB 1D
 * ex: binance
 * syms: BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated 45-day OBV volume-flow trend recipe that
 * performed strongly on BTC 1d, applied to BNB. On-Balance Volume tracks whether
 * money flows in or out over time; a rising 45-day OBV with price above the
 * 100-day average and volume confirmation signals accumulation-driven uptrend.
 * When it buys and sells: buys when 45-day OBV is clearly rising AND price is
 * above the 100-day average AND volume confirms; sells when 45-day OBV turns
 * down by 1.5%. ATR-scaled size cuts exposure in volatile regimes.
 * When it does NOT work: lags straight-line melt-ups because the 100-day gate
 * keeps it out of the early rally, and churns in choppy sideways markets where
 * OBV flips direction. BNB's history is shorter and its early data is thin.
 *
 * 2025-01-01: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) return null;

  const LOOKBACK = 45;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < LOOKBACK + 2) return null;

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < LOOKBACK + 1) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 1 - LOOKBACK];
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.985;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  if (pos > 0) {
    // 청산 대기: OBV가 내려와 45일 전 대비 1.5% 하락하면 매도
    ctx.watch([{
      side: 'sell',
      price: obvPast * 0.985,
      trigger: 'below',
      note: 'OBV 45d 1.5% 하락 시 매도',
      conds: [{ label: 'cd', now: cd, op: '==', ref: 0 }]
    }]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // 진입 대기: OBV 상승 + 가격이 SMA100 위 + 거래량 확인
  ctx.watch([{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'SMA100 상향 돌파',
    conds: [
      { label: 'OBV 45d 상승', ok: rising },
      { label: '거래량 > 30d 평균', ok: volOk },
      { label: 'cd', now: cd, op: '==', ref: 0 }
    ]
  }]);

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
