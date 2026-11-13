/*
 * @coinsori-strategy v1
 * name: BTC Slow Trend VIX-Scaled SPOT 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a slow EMA50/200 trend core steps aside in downtrends (so a crash hurts far
 * less than holding), and a real-fear knob from the CBOE VIX trims position size when fear is
 * unusually high. On spot this is long-only; the goal is to match most of the upside while
 * cutting the drawdown, which is a measurable win over buy-and-hold.
 * When it buys and sells: buys when EMA50 crosses above EMA200, exits when EMA50 crosses back
 * below or a 6xATR disaster stop is hit. Position size is scaled down smoothly as VIX rises
 * above its own 20-bar average.
 * When it does NOT work: in a long slow grind-up with mildly elevated VIX, the size cut caps the
 * upside and it trails buy-and-hold; it also sits flat through a slow bleed-down (that is the
 * point — it avoids that drawdown).
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e50b = ctx.ema(50, 2);
  const e200 = ctx.ema(200, 1);
  const atr1 = ctx.atr(14, 1);
  const vix = ctx.data("base_vix");
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  if (e50 == null || e50b == null || e200 == null || atr1 == null) return null;
  if (pos !== 0 && entry == null) return null;

  // VIX z-score vs its own recent mean (fear relative to itself, not a fixed level).
  let vixZ = 0;
  if (vix != null) {
    let hist = ctx.state.vixHist || [];
    hist.push(vix);
    if (hist.length > 80) hist = hist.slice(-80);
    ctx.state.vixHist = hist;
    if (hist.length >= 40) {
      const m = hist.reduce((a, b) => a + b, 0) / hist.length;
      let v = 0;
      for (const h of hist) v += (h - m) * (h - m);
      const s = Math.sqrt(v / hist.length);
      if (s > 1e-9) vixZ = (vix - m) / s;
    }
  }
  // Scale 1.0 when calm down to 0.25 when VIX is ~2.5 std above its own mean.
  const size = Math.max(0.25, Math.min(1.0, 1 - 0.3 * vixZ));

  const stopMult = 6.0; // disaster stop in ATR, hard cap on one bad call
  const stop = entry != null ? entry - stopMult * atr1 : null;

  ctx.watch([
    { side: 'buy', price: e200, trigger: 'above', note: 'EMA50 upcross EMA200', conds: [{ label: 'VIX z', now: vixZ, op: '<', ref: 2.5, closed: true }] },
    { side: 'sell', price: e200, trigger: 'below', note: 'EMA50 downcross EMA200' },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: '6 ATR disaster stop' }] : [])
  ]);

  if (pos === 0) {
    const crossUp = e50b <= e200 && e50 > e200;
    if (crossUp) return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 * size };
    return null;
  }

  if (ctx.price <= entry - stopMult * atr1 || e50 < e200) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
