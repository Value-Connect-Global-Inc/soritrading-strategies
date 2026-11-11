/*
 * @coinsori-strategy v1
 * name: BTC Trend + NDX Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC with an equity-regime ENTRY gate. Crypto has
 * tracked US equities (NASDAQ-100) closely since ~2020 — risk-on for stocks usually means
 * risk-on for crypto. This only takes BTC trend entries when NASDAQ is NOT in a clear
 * downtrend (its price not more than 2% below its own 90-day average). The gate is
 * entry-only: once in, we ride the trend and let the trend/stop decide the exit.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on BTC (trend up) AND NASDAQ
 * is not more than 2% below its 90-day average (i.e. not in a clear equity bear). Sell when
 * EMA50 crosses below EMA200, or the 3x ATR stop is hit. No macro-based exit.
 * When it does NOT work: in a flat chop the EMA crossover whipsaws and pays fees; in a
 * crypto-specific rally that equities do not join the NDX gate keeps it flat and it misses
 * the move. NASDAQ is a daily signal, so it cannot react to a fast intra-crypto crash.
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

  // Equity regime (entry only): NDX not >2% below its 90-day average. NDX is daily; at 4h
  // (6 bars/day) a true 90-day window is 540 pushed bars.
  const ndx = ctx.data('base.ndx');
  const st = ctx.state;
  st.ndxHist = st.ndxHist || [];
  if (ndx != null) {
    st.ndxHist.push(ndx);
    if (st.ndxHist.length > 600) st.ndxHist.shift();
  }
  let ndxOk = true;
  if (st.ndxHist.length >= 540) { // 540 bars = 90 real days at 4h
    const recent = st.ndxHist.slice(-540);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    // 2% below mean = clear equity downtrend; anything else (above, or mildly below) allows entries
    ndxOk = ndx != null && ndx >= mean * 0.98;
  }

  // ---- exits (trend + stop only, no macro exit) ----
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

  // ---- entries ----
  const trendUp = ema50prev <= ema200prev && ema50 > ema200;
  if (trendUp && ndxOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'EMA50/200 cross up',
      conds: [{ label: 'NDX not in clear bear', ok: ndxOk }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
