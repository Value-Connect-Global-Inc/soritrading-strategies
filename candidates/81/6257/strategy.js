/*
 * @coinsori-strategy v1
 * name: BTC Dual-Side Trend + NDX Gate Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends in both directions — big bull runs AND sharp crashes.
 * A long-only trend strategy sits out the crashes; this one also SHORTS them. But it
 * does not short blindly into an equity panic: the proven NDX entry gate (don't take a
 * fresh long when NASDAQ is more than 2% below its 90-day average) is kept for longs,
 * while the short side helps in falling periods. It holds a position at all times.
 * When it buys and sells: on a 4h closed bar, if EMA50 crosses above EMA200, go long (only
 * if the NDX gate allows a fresh long); if EMA50 crosses below EMA200, go short. A 3x ATR
 * stop protects each position. Sizing is 1x (no leverage).
 * When it does NOT work: in a flat chop the crossovers whipsaw and pay fees plus perp
 * funding on both sides; shorting a strong uptrend that briefly dips can be painful. In a
 * sustained one-way bull the short side never helps and the strategy trails a pure long.
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

  // NDX regime gate (long entries only): NDX not >2% below its 90-day average.
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

  const crossUp = ema50prev <= ema200prev && ema50 > ema200;
  const crossDown = ema50prev >= ema200prev && ema50 < ema200;
  const qty = (ctx.cash * 0.98) / ctx.price;

  // ---- long position ----
  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (crossDown) {
      ctx.watch([{ side: 'sell', price: close, trigger: 'below', note: 'cross down -> short' }]);
      return { side: 'sell', qty: qty, reduceOnly: false };
    }
    if (stop != null && close < stop) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '3x ATR stop (long)' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop (long)' }]);
    return null;
  }

  // ---- short position ----
  if (pos < 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx + 3 * atr : null;
    if (crossUp && ndxOk) {
      ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'cross up -> long' }]);
      return { side: 'buy', qty: qty, reduceOnly: false };
    }
    if (stop != null && close > stop) {
      ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: '3x ATR stop (short)' }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'buy', price: stop != null ? stop : close, trigger: 'above', note: '3x ATR stop (short)' }]);
    return null;
  }

  // ---- flat ----
  if (crossUp && ndxOk) {
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'cross up -> long' }]);
    return { side: 'buy', qty: qty };
  }
  if (crossDown) {
    ctx.watch([{ side: 'sell', price: close, trigger: 'below', note: 'cross down -> short' }]);
    return { side: 'sell', qty: qty };
  }

  ctx.watch([]);
  return null;
}
