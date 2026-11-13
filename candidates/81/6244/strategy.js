/*
 * @coinsori-strategy v1
 * name: ETH Trend + NDX Gate 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on ETH with an equity-regime ENTRY gate. ETH is a
 * higher-beta crypto that has tracked US equities (NASDAQ-100) closely since ~2020 — risk-on
 * for stocks usually means risk-on for crypto. This only takes ETH trend entries when NASDAQ
 * is NOT in a clear downtrend (its price not more than 5% below its own 90-day average). The
 * gate is entry-only: once in, we ride the trend and let the trend/stop decide the exit.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on ETH (trend up) AND NASDAQ is
 * not more than 5% below its 90-day average. Sell when EMA50 crosses below EMA200, or the 3x
 * ATR stop is hit. No macro-based exit.
 * When it does NOT work: in a flat chop the EMA crossover whipsaws and pays fees; in an
 * ETH-specific rally that equities do not join the NDX gate keeps it flat and it misses the
 * move; ETH can fall harder than BTC in a crypto crash, so the 3x ATR stop is essential.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

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

  // Equity regime (entry only): NDX not >5% below its 90-day average = only a SEVERE equity
  // bear blocks entries. ETH is higher-beta and has crypto-specific rallies, so the gate is
  // looser than the 2% used for BTC. NDX is daily; at 4h (6 bars/day) 90 days = 540 bars.
  const ndx = ctx.data('base.ndx');
  const st = ctx.state;
  st.ndxHist = st.ndxHist || [];
  if (ndx != null) {
    st.ndxHist.push(ndx);
    if (st.ndxHist.length > 600) st.ndxHist.shift();
  }
  let ndxOk = true;
  if (st.ndxHist.length >= 540) {
    const recent = st.ndxHist.slice(-540);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    ndxOk = ndx != null && ndx >= mean * 0.95;
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

  // ---- entries ----
  const trendUp = ema50prev <= ema200prev && ema50 > ema200;
  if (trendUp && ndxOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'EMA50/200 cross up',
      conds: [{ label: 'NDX not in severe bear', ok: ndxOk }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
