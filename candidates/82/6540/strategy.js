/*
 * @coinsori-strategy v1
 * name: BTC Regime-Filter Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends persist for weeks at a time, and the biggest losses come from staying long through a downtrend. A slow trend filter that steps aside when the medium trend turns down should keep most of an uptrend's return while cutting the drawdown.
 * When it buys and sells: buys when the 50-bar EMA crosses above the 200-bar EMA (golden cross) and sells when it crosses below (death cross) — a classic trend confirmation that filters out small price noise around the average. A hard stop-loss caps any single losing position.
 * When it does NOT work: in a choppy sideways market the two EMAs grind together and the strategy whipsaws in and out, paying fees without a trend to ride — this loses to holding in flat regimes.
 */
function onUpdate(ctx) {
  // ---- dual-EMA trend on closed bars (ago>=1 so backtest/live agree) ----
  const f = ctx.ema(50, 1);
  const fp = ctx.ema(50, 2);
  const s = ctx.ema(200, 1);
  const sp = ctx.ema(200, 2);
  if (f == null || fp == null || s == null || sp == null) return null;

  const goldenCross = fp <= sp && f > s;   // fast crossed above slow
  const deathCross = fp >= sp && f < s;    // fast crossed below slow

  const pos = ctx.position || 0;

  // hard stop: 8% below entry, always on while holding (cap a single loss)
  let stop = null;
  if (pos > 0 && ctx.entryPx != null) {
    stop = ctx.entryPx * 0.92;
  }

  ctx.watch([
    { side: 'buy', price: s, trigger: 'above', note: 'golden cross', conds: [{ label: 'EMA50 > EMA200', ok: f > s, closed: true }] },
    { side: 'sell', price: s, trigger: 'below', note: 'death cross', conds: [{ label: 'EMA50 < EMA200', ok: f < s, closed: true }] },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }] : [])
  ]);

  // exit: stop-loss first
  if (pos > 0 && stop != null && ctx.price <= stop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // exit: trend turns down -> step aside to cash
  if (pos > 0 && deathCross) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // entry: trend turns up -> go long (size ~95% of cash)
  if (pos === 0 && goldenCross) {
    const qty = (ctx.cash / ctx.price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  return null;
}
