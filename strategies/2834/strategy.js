/*
 * @coinsori-strategy v1
 * name: OBV Trend + Drawdown Position Cap BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV trend champion (2820) has high drawdown (~29-50%)
 * because it stays fully invested through sharp reversals. This variant keeps
 * the exact same buy/sell signals but GENTLY trims position size only when the
 * account is in a deep drawdown from its peak — a persistent exposure reduction
 * that lowers MDD while keeping most of the trend upside.
 * When it buys and sells: same as the champion — buys rising 30-day OBV above
 * the 100-day average with volume, exits on falling OBV. Position size is scaled
 * down by volatility stress and, only beyond a 10% account drawdown, trimmed
 * linearly to 60% size at a 30% drawdown.
 * When it does NOT work: the cap still trims size during recoveries after a
 * crash, so it misses part of the bounce; and in a long grinding bear it keeps
 * size small just as the recovery starts.
 * 2025-01-01: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) return null;

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

  // GENTLE drawdown cap: full size up to 10% drawdown, trim linearly to 60% at 30%.
  const equity = ctx.cash + pos * price;
  let peak = st.peak != null ? st.peak : equity;
  if (equity > peak) peak = equity;
  ctx.state.peak = peak;
  const ddFromPeak = peak > 0 ? (peak - equity) / peak : 0;
  let ddFrac = 1.0;
  if (ddFromPeak > 0.10) {
    ddFrac = 1.0 - ((ddFromPeak - 0.10) / 0.20) * 0.40; // 100% -> 60%
  }
  ddFrac = Math.max(0.60, Math.min(1.0, ddFrac));

  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }
  sizeFrac = sizeFrac * ddFrac;

  if (pos > 0) {
    // Display: waiting to exit when OBV falls below 99% of 30-bar-ago value
    ctx.watch([
      { side: 'sell', price: obvPast * 0.99, trigger: 'below', note: 'OBV falling exit', conds: [{ label: 'OBV now', now: obvNow, op: '<', ref: obvPast * 0.99, closed: true }, { label: 'cooldown', ok: cd === 0 }] }
    ]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Display: waiting to buy when OBV rises, price above SMA100, volume OK
  ctx.watch([
    { side: 'buy', price: sma100, trigger: 'above', note: 'SMA100 breakout', conds: [{ label: 'OBV rising', ok: rising }, { label: 'volume > avg', ok: volOk }, { label: 'cooldown', ok: cd === 0 }] }
  ]);

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
