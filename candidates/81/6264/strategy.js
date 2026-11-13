/*
 * @coinsori-strategy v1
 * name: BTC Trend + OI Confirmation 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC with an open-interest confirmation gate.
 * A rally backed by RISING open interest means new longs are entering — the move is real
 * and tends to continue. A rally with FALLING open interest is often short-covering or
 * fading momentum — it stalls. We only take BTC trend entries when OI is rising (positioning
 * confirms the move), and ride the trend until it breaks.
 * When it buys and sells: buy when EMA50 crosses above EMA200 (trend up) AND open interest is
 * above its own ~4-day average (new money confirming the trend). Sell when EMA50 crosses below
 * EMA200, or the 3x ATR stop is hit.
 * When it does NOT work: in a flat chop the EMA crossover whipsaws and pays fees; when a real
 * breakout happens on UNCHANGED or falling OI (e.g. a spot-led or short-squeeze rally) the OI
 * gate keeps it flat and it misses the move. OI is a perp-market signal, so it is blind to a
 * purely spot-driven rally.
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

  // Open interest confirmation (entry only): OI must be above its own ~4-day average.
  // At 4h (6 bars/day) a 4-day window is 24 pushed bars. Rising OI = new longs entering.
  const oi = ctx.binanceOi();
  const st = ctx.state;
  st.oiHist = st.oiHist || [];
  st.oiCount = st.oiCount || 0;
  if (oi != null && oi > 0) {
    st.oiHist.push(oi);
    st.oiCount++;
    if (st.oiHist.length > 200) st.oiHist.shift();
  }
  ctx.logOnce('oiAvailable', 'OI valid bars so far: ' + st.oiCount + ' / ' + ctx.i);
  let oiOk = true;
  if (st.oiHist.length >= 24) { // 24 bars = 4 real days at 4h
    const recent = st.oiHist.slice(-24);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    oiOk = oi != null && oi >= mean; // OI at/above its 4d mean = new money confirming
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
  if (trendUp && oiOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'EMA50/200 cross up',
      conds: [{ label: 'OI above 4d mean', ok: oiOk }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
