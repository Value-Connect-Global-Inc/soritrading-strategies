/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's worst drawdowns almost always arrive together with a spike in the CBOE Volatility Index (VIX). This strategy holds BTC only while volatility is calm and steps aside to cash when fear spikes, aiming to keep most of the upside with a much smaller drawdown than buy-and-hold.
 * When it buys and sells: It buys when the VIX is below its own recent average (calm, risk-on) and sells when the VIX climbs well above its recent average (fear, risk-off) or if the price falls 25% from the entry.
 * When it does NOT work: In a slow, grinding bear market with no fear spikes (VIX stays low), it stays long and loses like buy-and-hold. In a sharp V-shaped recovery it can sell near the bottom and miss the first rebound.
 */

function onUpdate(ctx) {
  const vix = ctx.data("base.vix");

  // Keep a rolling history of daily VIX in persistent state (survives restarts).
  let hist = ctx.state.vixHist || [];
  if (vix != null) {
    hist.push(vix);
    if (hist.length > 250) hist = hist.slice(-250);
    ctx.state.vixHist = hist;
  }

  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // Not enough VIX history yet to judge the regime — wait.
  if (hist.length < 60) {
    ctx.watch([]);
    return null;
  }

  // z-score of today's VIX vs its own recent average (shape, not a fixed level).
  let z = null;
  if (vix != null) {
    const N = 120; // ~4 months of daily VIX = one volatility regime
    const recent = hist.slice(-N);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const sd = Math.sqrt(recent.reduce((a, b) => a + (b - mean) * (b - mean), 0) / recent.length);
    if (sd > 0) z = (vix - mean) / sd;
  }

  // Hysteresis band: enter calm (z below -0.3), exit fearful (z above +0.8).
  // The gap stops the strategy flipping on tiny VIX wobbles.
  const ENTER_Z = -0.3;
  const EXIT_Z = 0.8;
  const STOP_PCT = 0.75; // hard stop: cut a trade that falls 25% from entry

  if (pos > 0) {
    const stopPx = entryPx != null ? entryPx * STOP_PCT : null;
    const stopHit = stopPx != null && ctx.price <= stopPx;
    const fearExit = z != null && z > EXIT_Z;
    const decls = [];
    if (stopPx != null) decls.push({ side: 'sell', price: stopPx, trigger: 'below', note: '25% stop' });
    decls.push({ side: 'sell', price: ctx.price, trigger: 'below', note: 'VIX fear exit', conds: [{ label: 'VIX z-score', now: z != null ? z : 0, op: '>', ref: EXIT_Z, closed: true }] });
    ctx.watch(decls);
    if (fearExit || stopHit) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const decls = [];
  decls.push({ side: 'buy', price: ctx.price, trigger: 'below', note: 'calm regime buy', conds: [{ label: 'VIX z-score', now: z != null ? z : 0, op: '<', ref: ENTER_Z, closed: true }] });
  ctx.watch(decls);
  if (z != null && z < ENTER_Z) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    return { side: 'buy', qty };
  }
  return null;
}
