/*
 * @coinsori-strategy v1
 * name: 45d OBV Trend Relaxed Exit BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The no-Fed 45-day OBV trend works on all windows but
 * still lags buy-and-hold on the recent 2023-26 melt-up (+81.6% vs +373%),
 * capturing only ~22% of the rally. Hypothesis: the 1% exit threshold on
 * 45-day OBV (0.99) fires on brief pullbacks inside a steady uptrend, then
 * re-enters late. This relaxes the exit to 0.985 so the position holds
 * through minor pullbacks and rides more of the melt-up.
 * When it buys and sells: buys when 45-day OBV is rising AND price is above
 * the 100-day average AND volume confirms. Exits fully only when 45-day OBV
 * falls by 1.5% (relaxed from 1%).
 * When it does NOT work: a relaxed exit holds longer into real downturns, so
 * drawdown is higher when OBV rolls over slowly. It also re-enters late after
 * genuine trend breaks.
 * 2025-01-14: watch declarations added — display only, trading logic unchanged.
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
  // relaxed exit: 1.5% OBV drop instead of 1% (hold through minor pullbacks)
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
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      ctx.watch([{ side: 'sell', price: obvPast * 0.985, trigger: 'below', note: 'OBV 45d falling 1.5%', conds: [{ label: 'OBV 45d', now: obvNow, op: '<', ref: obvPast * 0.985, closed: true }] }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: obvPast * 0.985, trigger: 'below', note: 'OBV 45d falling 1.5%', conds: [{ label: 'OBV 45d', now: obvNow, op: '<', ref: obvPast * 0.985, closed: true }] }]);
    return null;
  }

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    ctx.watch([{ side: 'buy', price: obvPast * 1.01, trigger: 'above', note: 'OBV 45d rising 1%', conds: [{ label: 'OBV 45d', now: obvNow, op: '>', ref: obvPast * 1.01, closed: true }, { label: 'Price > SMA100', ok: price > sma100 }, { label: 'Volume > avg30', ok: volOk }] }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: obvPast * 1.01, trigger: 'above', note: 'OBV 45d rising 1%', conds: [{ label: 'OBV 45d', now: obvNow, op: '>', ref: obvPast * 1.01, closed: true }, { label: 'Price > SMA100', ok: price > sma100 }, { label: 'Volume > avg30', ok: volOk }] }]);
  return null;
}
