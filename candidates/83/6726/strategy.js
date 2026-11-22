/*
 * @coinsori-strategy v1
 * name: BTC 4H VIX-Guarded Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: BTC 4h prices trend for weeks at a time, and the worst
 * entries happen right as volatility explodes (the VIX index spiking far above
 * its own normal level). We ride the uptrend but refuse to open new positions
 * during volatility spikes.
 * When it buys and sells: buys when the 4h close is above its 100-bar average
 * and volatility is normal; sells when the close falls back below that average.
 * When it does NOT work: in a sideways market the average-crossing signal
 * flip-flops and trading fees eat the small moves; after a violent V-shaped
 * crash it exits late and misses the fast recovery.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;

  // Trend core reads CLOSED bars (ago=1) so it behaves identically in
  // backtest, paper and live.
  const ema = ctx.ema(100, 1);
  if (ema == null) return null;
  const prevClose = ctx.closes.at(-2);

  // --- VIX risk gate: z-score of today's VIX vs its own last ~250 days ---
  // base_vix is a daily macro value; we accumulate it in restart-safe state so
  // we can measure "far above its own norm" instead of a fixed level.
  const vix = ctx.data('base_vix');
  let vixZ = null;
  if (vix != null) {
    const st = ctx.state.vixHist || [];
    const last = st.length ? st[st.length - 1] : null;
    if (last == null || Math.abs(last.v - vix) > 1e-9) {
      st.push({ v: vix });
      if (st.length > 250) st.splice(0, st.length - 250);
      ctx.state.vixHist = st;
    }
    if (st.length >= 30) {
      let m = 0; for (const e of st) m += e.v; m /= st.length;
      let sd = 0; for (const e of st) sd += (e.v - m) * (e.v - m); sd = Math.sqrt(sd / st.length);
      if (sd > 1e-9) vixZ = (vix - m) / sd;
    }
  }
  // Block NEW entries only while VIX is >1.5 sigma above its norm (1.5 = a
  // clear volatility spike, not a normal wiggle). We never panic-sell a held
  // position on the VIX gate alone.
  const riskOff = vixZ != null && vixZ > 1.5;

  const pos = ctx.position || 0;
  const cooldownUntil = ctx.state.cooldownUntil || 0;

  // --- declarations for the run card (what each order is waiting for) ---
  const w = [{ side: 'buy', price: ema, trigger: 'above', note: 'close>EMA100 (trend up)' }];
  if (vixZ != null) w[0].conds = [{ label: 'VIX z-score', now: +vixZ.toFixed(2), op: '<=', ref: 1.5, closed: true }];
  if (pos > 0) {
    w.push({ side: 'sell', price: ema, trigger: 'below', note: 'close<EMA100 exit' });
  }
  ctx.watch(w);

  // --- orders ---
  if (pos > 0) {
    if (prevClose < ema) {
      // 12 bars = 2 days of 4h bars: let the dust settle before re-buying
      // after an exit, so a trend flip is not immediately followed by re-entry.
      ctx.state.cooldownUntil = ctx.i + 12;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.i < cooldownUntil) return null;
  if (prevClose > ema && !riskOff) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
