/*
 * @coinsori-strategy v1
 * name: BTC Trend + VIX Crash-Shield 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC rallies are long and persistent but interrupted by
 * violent crash drawdowns. A simple long-bias trend core (close above its
 * 100-bar EMA) stays in the market through the whole up-move, and a VIX
 * crash-shield (CBOE Volatility Index z-scored against its own 60-day mean)
 * steps out before the crashes that kill buy-and-hold drawdowns.
 * When it buys and sells: buys when the 4h close is above its 100-bar EMA
 * while VIX is calm (z-score < 1.5). Sells when the close drops below the
 * 100-bar EMA, or immediately when VIX spikes (z-score > 2.5) even if the
 * trend is still intact.
 * When it does NOT work: VIX data arrives with a 2-day lag, so a sudden
 * same-day crash (March 2020) can still hit before the shield fires; and in a
 * choppy sideways market the EMA100 cross whipsaws and pays fees.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const ema100 = ctx.ema(100, 1);
  if (ema100 == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2);

  // --- VIX z-score vs its own recent mean (one value per day, prior days only)
  const vix = ctx.data('base_vix');
  const day = Math.floor(ctx.times.at(-1) / 86400);
  let st = ctx.state.vix || { hist: [], lastDay: 0, z: null };
  if (vix != null && day !== st.lastDay) {
    if (st.hist.length >= 30) {
      const n = st.hist.length;
      const m = st.hist.reduce((a, b) => a + b, 0) / n;
      const sd = Math.sqrt(st.hist.reduce((a, b) => a + (b - m) * (b - m), 0) / n);
      st.z = sd > 0 ? (vix - m) / sd : 0;
    }
    st.hist.push(vix);
    if (st.hist.length > 60) st.hist.shift();
    st.lastDay = day;
    ctx.state.vix = st;
  }
  const vixZ = st.z;

  const aboveTrend = prevClose != null && prevClose > ema100;
  const belowTrend = prevClose != null && prevClose < ema100;
  const crash = vixZ != null && vixZ > 2.5; // VIX >2.5 sigma above its own mean = crash regime
  const calm = vixZ == null || vixZ < 1.5;  // need VIX to settle before re-entering

  const watch = [];
  if (pos > 0) {
    watch.push({ side: 'sell', price: ema100, trigger: 'below', note: 'close<EMA100 or VIX crash', conds: [
      { label: 'VIX z>2.5', ok: crash }
    ]});
    ctx.watch(watch);
    if (belowTrend || crash) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  watch.push({ side: 'buy', price: ema100, trigger: 'above', note: 'close>EMA100 + VIX calm', conds: [
    { label: 'VIX calm', ok: calm }
  ]});
  ctx.watch(watch);
  if (aboveTrend && calm) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
