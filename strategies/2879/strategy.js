/*
 * @coinsori-strategy v1
 * name: 45d OBV Trend SOL 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The validated 45-day OBV volume-flow trend recipe that
 * performed strongly on BTC 1d, applied to SOL. On-Balance Volume tracks whether
 * money flows in or out over time; a rising 45-day OBV with price above the
 * 100-day average and volume confirmation signals accumulation-driven uptrend.
 * When it buys and sells: buys when 45-day OBV is clearly rising AND price is
 * above the 100-day average AND volume confirms; sells when 45-day OBV turns
 * down by 1.5%. ATR-scaled size cuts exposure in volatile regimes.
 * When it does NOT work: lags straight-line melt-ups because the 100-day gate
 * keeps it out of the early rally, and churns in choppy sideways markets where
 * OBV flips direction. SOL is far more volatile than BTC, so drawdowns here
 * can be large.
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
    ctx.watch([{ side: 'sell', note: '45d OBV downturn', conds: [
      { label: '45d OBV falling', ok: falling },
      { label: 'cooldown ready', ok: cd === 0 },
    ]}]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: '100d SMA gate + OBV uptrend', conds: [
    { label: '45d OBV rising', ok: rising },
    { label: 'volume > 30d avg', ok: volOk },
    { label: 'cooldown ready', ok: cd === 0 },
  ]}]);
  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
