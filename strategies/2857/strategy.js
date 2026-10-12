/*
 * @coinsori-strategy v1
 * name: Pure 45d OBV Trend (no Fed gate) BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fed-filtered 45-day OBV champion beat buy-and-hold
 * on the 2017-21 and 2019-23 windows but FAILED on the recent 2023-26 window
 * (+0.68% vs hold +373%), churning 104 trades. Hypothesis: the Fed not-hiking
 * gate blocks entries during 2023-24 hikes and causes the miss/churn. This
 * removes the Fed gate to test whether the pure 45-day OBV trend captures the
 * recent melt-up that the gated version missed.
 * When it buys and sells: buys when 45-day OBV is rising AND price is above
 * the 100-day average AND volume confirms. Exits fully when 45-day OBV turns
 * down.
 * When it does NOT work: without the Fed gate it stays long through hiking
 * bears, so it likely has higher drawdown in hiking regimes (the Fed gate
 * was added to cut MDD 45->39 on 2017-21). This is the trade-off being tested.
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 추가)
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

  const LOOKBACK = 45;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < LOOKBACK + 2) {
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
  if (obvSeries.length < LOOKBACK + 1) {
    ctx.watch([]);
    return null;
  }
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 1 - LOOKBACK];
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

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
    ctx.watch([{
      side: 'sell',
      note: 'OBV(45) turn down',
      conds: [
        { label: 'OBV(45) falling', ok: falling },
        { label: 'Cooldown ready', ok: cd === 0 }
      ]
    }]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'Price > SMA100',
    conds: [
      { label: 'OBV(45) rising', ok: rising },
      { label: 'Volume > avgVol(30)', ok: volOk },
      { label: 'Cooldown ready', ok: cd === 0 }
    ]
  }]);

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
