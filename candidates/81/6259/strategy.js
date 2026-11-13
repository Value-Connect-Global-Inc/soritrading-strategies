/*
 * @coinsori-strategy v1
 * name: BTC Trend + NDX Gate + VIX Sizing 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven BTC EMA50/200 + NDX-gate trend, with one addition: position
 * size is scaled DOWN when market volatility (VIX) is in its upper percentiles. In a panic
 * regime the same trend signal has worse odds, so we risk less; in a calm regime we run full
 * size. This is a sizing rule, not an entry gate — it never blocks a signal, so it does not
 * miss rallies the way a hard gate does.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on BTC AND NASDAQ is not in a
 * clear equity downtrend. Position size = full when VIX is below its 70th percentile of the
 * last ~90 days, scaling down to 30% at the highest VIX percentiles. Sell when EMA50 crosses
 * below EMA200, or the 3x ATR stop is hit.
 * When it does NOT work: in a flat chop the EMA crossover whipsaws and pays fees; in a
 * crypto-specific rally that equities do not join, the NDX gate keeps it flat; sizing down in
 * a panic that quickly reverses (V-recovery) means smaller size during the bounce.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

  // Closed-bar indicators (identical in backtest/live).
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema50prev = ctx.ema(50, 2);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || ema50prev == null || ema200prev == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);
  const st = ctx.state;

  // NDX regime gate (entry only).
  const ndx = ctx.data('base.ndx');
  st.ndxHist = st.ndxHist || [];
  if (ndx != null) {
    st.ndxHist.push(ndx);
    if (st.ndxHist.length > 600) st.ndxHist.shift();
  }
  let ndxOk = true;
  if (st.ndxHist.length >= 540) { // 540 bars = 90 real days at 4h
    const recent = st.ndxHist.slice(-540);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    ndxOk = ndx != null && ndx >= mean * 0.98;
  }

  // VIX percentile over the trailing ~90 days (VIX is daily; repeated values are fine
  // for a percentile). Size = 1.0 when VIX is below its 70th percentile, scaling down
  // linearly to 0.3 at the very top of its recent range.
  const vix = ctx.data('base.vix');
  st.vixHist = st.vixHist || [];
  if (vix != null) {
    st.vixHist.push(vix);
    if (st.vixHist.length > 540) st.vixHist.shift();
  }
  let size = 1;
  if (st.vixHist.length >= 200) {
    const below = st.vixHist.filter((x) => x <= vix).length;
    const pct = below / st.vixHist.length;
    size = Math.min(1, Math.max(0.3, 1.3 - pct));
  }

  // ---- exits (trend + stop only) ----
  if (pos > 0) {
    const trendDown = ema50prev >= ema200prev && ema50 < ema200;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (trendDown || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'trend/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  // ---- entries: full trend signal, scaled by VIX ----
  const trendUp = ema50prev <= ema200prev && ema50 > ema200;
  if (trendUp && ndxOk) {
    const qty = (ctx.cash * 0.98 * size) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'EMA50/200 cross up',
      conds: [{ label: 'NDX not in clear bear', ok: ndxOk }, { label: 'VIX size', now: size, op: '<=', ref: 1, closed: true }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
