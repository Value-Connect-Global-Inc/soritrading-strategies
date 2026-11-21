/*
 * @coinsori-strategy v1
 * name: BTC Yield-Curve Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: An inverted US yield curve (10Y minus 2Y going negative)
 * historically flags recession and risk-off, when high-beta assets like
 * Bitcoin tend to fall. Gating a simple uptrend rule on the yield curve
 * should keep the position out of the worst risk-off periods and cut
 * drawdown versus plain buy-and-hold.
 * When it buys and sells: Buy when the daily close is above the 50-day
 * average AND the 10Y-2Y curve is NOT inverted (positive). Sell when the
 * close falls back below the 50-day average.
 * When it does NOT work: If Bitcoin rallies while the curve is still
 * inverted (early-stage recovery), the gate keeps it out and it misses part
 * of the move. In a crypto-only bear market with a healthy curve the gate
 * does not help and the trend rule alone is exposed.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) { ctx.watch([]); return null; }

  // 10Y-2Y spread in percentage points; negative = inverted curve (risk-off).
  const t10y2y = ctx.data("base.t10y2y");
  const pos = ctx.position || 0;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'trend break' }]);
    if (prevClose < sma50) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const trendUp = prevClose > sma50;
  // Entry gate: do not start a long while the yield curve is inverted.
  const curveOk = t10y2y != null && t10y2y > 0;
  const buyWatch = { side: 'buy', price: sma50, trigger: 'above', note: 'uptrend + curve not inverted' };
  if (t10y2y != null) buyWatch.conds = [{ label: '10Y-2Y spread', now: t10y2y, op: '>', ref: 0 }];
  ctx.watch([buyWatch]);
  if (trendUp && curveOk) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
