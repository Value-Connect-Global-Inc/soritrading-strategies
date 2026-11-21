/*
 * @coinsori-strategy v1
 * name: BTC 4H Macro-Gated Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC is a risk asset — it falls when financial conditions tighten (dollar strengthens)
 * or when volatility spikes. Buying deep pullbacks only while the macro regime is calm
 * (VIX not elevated, dollar not strong) avoids catching falling knives and captures the
 * snap-back toward the average.
 * Buys when price drops far below its own 100-bar average (z-score <= -1.8) while VIX and
 * the dollar are both near or below their own recent means; sells when price reverts toward
 * the average, the macro regime turns risk-off, or the ATR stop is hit.
 * Does NOT work in a persistent bear market where every dip keeps falling (the stop caps
 * each loss but the reversion never comes), and it stays in cash during strong up-trends
 * that never pull back, so it misses part of a rally.
 */
function onUpdate(ctx) {
  const z       = ctx.zscore(100, 1);
  const sma100  = ctx.sma(100, 1);
  const sd100   = ctx.stdev(100, 1);
  const atr     = ctx.atr(14, 1);
  const vix     = ctx.data("base.vix");
  const usd     = ctx.data("base.usd_broad");
  const close1  = ctx.closes.at(-2);
  if (z == null || sma100 == null || sd100 == null || atr == null || vix == null || usd == null || close1 == null) {
    ctx.watch([]);
    return null;
  }

  // rolling 90-day history of VIX and USD (pushed once per day, cap 90 points)
  const st = ctx.state;
  if (!st.vixHist) st.vixHist = [];
  if (!st.usdHist) st.usdHist = [];
  const dayKey = Math.floor(ctx.times.at(-1) / 86400);
  if (st.dayKey !== dayKey) {
    st.dayKey = dayKey;
    st.vixHist.push(vix);
    st.usdHist.push(usd);
    if (st.vixHist.length > 90) st.vixHist.shift();
    if (st.usdHist.length > 90) st.usdHist.shift();
  }
  if (st.vixHist.length < 30 || st.usdHist.length < 30) { ctx.watch([]); return null; } // need a baseline

  function zOf(arr, val) {
    let m = 0; for (const v of arr) m += v; m /= arr.length;
    let s = 0; for (const v of arr) s += (v - m) * (v - m); s = Math.sqrt(s / arr.length);
    if (s < 1e-9) return 0;
    return (val - m) / s;
  }
  const vixZ = zOf(st.vixHist, vix);
  const usdZ = zOf(st.usdHist, usd);

  const price = ctx.price;

  // --- exits (in position) ---
  if (ctx.position > 0) {
    // bars in position counter for the time stop
    st.barsInPos = (st.barsInPos || 0) + 1;
    const reversionPx = sma100 - 0.2 * sd100;   // zscore back to -0.2 = "reverted"
    const stopPx = ctx.entryPx != null ? ctx.entryPx - 1.5 * atr : null;
    const watch = [
      { side: 'sell', price: reversionPx, trigger: 'above', note: 'reverted to mean' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '1.5xATR stop' }
    ];
    if (st.barsInPos > 120) watch.push({ side: 'sell', note: 'time stop 20 days' }); // no time price; ok as info
    ctx.watch(watch);

    if (z >= -0.2) { st.barsInPos = 0; return { side: 'sell', qty: ctx.position, reduceOnly: true }; }
    if (stopPx != null && price < stopPx) { st.barsInPos = 0; return { side: 'sell', qty: ctx.position, reduceOnly: true }; }
    if (vixZ > 1.5 || usdZ > 1.5) { st.barsInPos = 0; return { side: 'sell', qty: ctx.position, reduceOnly: true }; } // regime turned risk-off
    if (st.barsInPos > 120) { st.barsInPos = 0; return { side: 'sell', qty: ctx.position, reduceOnly: true }; }
    return null;
  }
  st.barsInPos = 0;

  // --- entry (flat only) ---
  const entryPx = sma100 - 1.8 * sd100;   // price that would make zscore = -1.8
  const watch = [{
    side: 'buy', price: entryPx, trigger: 'below', note: 'deep pullback z<=-1.8',
    conds: [
      { label: 'VIX z vs 90d', now: vixZ, op: '<=', ref: 0.5, closed: true },
      { label: 'USD z vs 90d', now: usdZ, op: '<=', ref: 0.5, closed: true }
    ]
  }];
  ctx.watch(watch);

  if (z <= -1.8 && vixZ <= 0.5 && usdZ <= 0.5) {
    // risk 2% of equity on the 1.5xATR stop so one loss cannot hurt much
    const riskAmt = ctx.cash * 0.02;
    const stopDist = 1.5 * atr;
    let qty = riskAmt / stopDist;
    const maxQty = (ctx.cash / price) * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
