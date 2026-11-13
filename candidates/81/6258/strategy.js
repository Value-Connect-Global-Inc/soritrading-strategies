/*
 * @coinsori-strategy v1
 * name: SOL Trend + NDX Gate 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven BTC EMA50/200 + NDX-gate framework ported to SOL, a
 * higher-beta asset that rises more in crypto bull markets. The NDX entry gate (no fresh
 * long when NASDAQ is more than 2% below its 90-day average) and the 3x ATR stop protect
 * drawdown, while SOL's bigger up-moves give more upside than BTC in risk-on periods.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on SOL AND NASDAQ is not in
 * a clear equity downtrend. Sell when EMA50 crosses below EMA200, or the 3x ATR stop is hit.
 * When it does NOT work: SOL falls much harder than BTC in crypto crashes, so a late exit
 * costs more; in a flat chop the EMA crossover whipsaws and pays fees; in a crypto-specific
 * rally that equities do not join the NDX gate keeps it flat and it misses the move.
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
    ndxOk = ndx != null && ndx >= mean * 0.98;
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
      conds: [{ label: 'NDX not in clear bear', ok: ndxOk }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
