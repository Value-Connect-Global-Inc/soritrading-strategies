/*
 * @coinsori-strategy v1
 * name: SOL OBV Volume-Flow Trend 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: when volume is flowing into an asset (on-balance volume rising)
 * while the long-term trend is still up, the move tends to continue. This rides that
 * confirmed volume-backed uptrend, which the defensive mean-reversion strategy misses.
 * When it buys and sells: buys when price is above its 100-day average AND the
 * on-balance-volume line is above its own 20-day average (volume confirming the push).
 * Sells when price falls back below the 100-day average or the volume line rolls over.
 * When it does NOT work: in a choppy sideways market the trend gate whips it in and
 * out, and in a sharp V-shaped crash it exits late so drawdown is higher than the
 * defensive strategy. It needs a real, volume-backed uptrend to exist.
 *
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const closes = ctx.closes;
  const volumes = ctx.volumes;
  const sma100 = ctx.sma(100, 1);
  if (sma100 == null || !closes || !volumes || closes.length < 30 || volumes.length < 30) {
    ctx.watch([]);
    return null;
  }

  // Build the OBV series from the last ~130 bars (cumulative volume flow).
  const n = Math.min(closes.length, 130);
  const obv = [];
  let acc = 0;
  for (let k = 1; k < n; k++) {
    const cNow = closes[closes.length - 1 - (n - 1 - k)];
    const cPrev = closes[closes.length - 1 - (n - 1 - k) - 1];
    const v = volumes[volumes.length - 1 - (n - 1 - k)] || 0;
    if (cNow > cPrev) acc += v;
    else if (cNow < cPrev) acc -= v;
    obv.push(acc);
  }
  if (obv.length < 21) {
    ctx.watch([]);
    return null;
  }

  // OBV vs its own 20-bar average.
  const curOBV = obv[obv.length - 1];
  const prevOBV = obv[obv.length - 2];
  let sum = 0;
  for (let k = obv.length - 20; k < obv.length; k++) sum += obv[k];
  const obvAvg = sum / 20;

  const pos = ctx.position;

  if (pos > 0) {
    // Exit: uptrend broke or volume flow rolled over.
    if (price < sma100 || curOBV < obvAvg) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry: uptrend intact AND volume flowing in (OBV crossing above its average).
  if (price > sma100 && prevOBV <= obvAvg && curOBV > obvAvg) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
