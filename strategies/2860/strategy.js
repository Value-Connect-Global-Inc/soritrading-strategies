/*
 * @coinsori-strategy v1
 * name: 45d OBV Much-Relaxed Exit BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion 45d OBV trend (2858) only captures ~22% of
 * the recent 2023-26 melt-up (+81.6% vs hold +373%) because its 1.5% OBV exit
 * threshold (0.985) fires on minor pullbacks inside a strong uptrend, then
 * re-enters late. This relaxes the exit to 0.97 so the position holds through
 * deeper pullbacks and rides more of the melt-up, while keeping the 45d
 * lookback (the 60d-lookback variant failed, so lookback stays at 45d).
 * When it buys and sells: buys when 45-day OBV is rising AND price is above
 * the 100-day average AND volume confirms. Exits fully only when 45-day OBV
 * falls by 3% (relaxed from 1.5%).
 * When it does NOT work: a much-relaxed exit holds longer into real downturns,
 * so drawdown is higher when OBV rolls over slowly — the risk is the 2022 bear
 * where a slow exit gives back gains. It also re-enters late after genuine
 * trend breaks.
 * 2026-01-18: display-only ctx.watch added, trading logic unchanged.
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
  // much-relaxed exit: 3% OBV drop instead of 1.5% (hold through deeper pullbacks to capture more melt-up)
  const falling = obvNow < obvPast * 0.97;

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
    if (falling && cd === 0) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'OBV -3% exit', qty: pos, conds: [{ label: 'OBV 45d falling', ok: falling, closed: true }] }]);
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'OBV -3% exit', qty: pos, conds: [{ label: 'OBV 45d falling', ok: falling, closed: true }] }]);
    return null;
  }

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'OBV rise + SMA100 + vol', qty: ctx.cash / price * 0.95 * sizeFrac, conds: [{ label: 'OBV 45d rising', ok: rising, closed: true }, { label: 'Price > SMA100', now: price, op: '>', ref: sma100, closed: true }, { label: 'Vol > avg30', ok: volOk, closed: true }] }]);
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
