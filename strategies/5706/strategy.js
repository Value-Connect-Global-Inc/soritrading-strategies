/*
 * @coinsori-strategy v1
 * name: SOL Bollinger Squeeze Breakout 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A different signal source than price trend or mean reversion —
 * volatility itself. Markets alternate between quiet compression (Bollinger Bands
 * narrow) and violent expansion. Buying the breakout after a squeeze rides the
 * expansion leg, which in crypto tends to be sharp and directional.
 * When it buys and sells: It buys when the Bollinger Band width is below its own
 * 40-bar average (a squeeze — volatility compressed) and price then closes above
 * the highest close of that squeeze period (the breakout). It sells on a 2.5-ATR
 * trailing stop below the highest close since entry, or a 3-ATR hard stop.
 * When it does NOT work: In a grinding sideways market the expansion after a
 * squeeze is weak and the breakout fails, churning small losses. In a slow
 * one-way melt-up with no prior compression it never enters and lags buy-and-hold.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || atr == null || atr <= 0) return null;
  const mid = (bb.upper + bb.lower) / 2;
  if (mid <= 0) return null;
  const width = (bb.upper - bb.lower) / mid;

  const st = ctx.state;
  if (st.hist == null) st.hist = [];
  st.hist.push(width);
  if (st.hist.length > 40) st.hist.shift();
  if (st.hist.length < 40) return null; // warm up the width history

  let sum = 0;
  for (let k = 0; k < st.hist.length; k++) sum += st.hist[k];
  const avgWidth = sum / st.hist.length;
  const squeeze = width < avgWidth * 0.95; // compressed below its own recent average

  const pos = ctx.position;
  if (pos > 0) {
    const peak = st.peak != null ? Math.max(st.peak, price) : price;
    st.peak = peak;
    const trail = peak - 2.5 * atr; // let winners run, cut a real reversal
    const hardStop = st.entry != null ? st.entry - 3 * atr : null;
    ctx.watch([
      { side: 'sell', price: trail, trigger: 'below', note: '2.5 ATR trail' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '3 ATR hard stop' }
    ]);
    if (price < trail || (hardStop != null && price < hardStop)) {
      st.peak = null; st.entry = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // While compressed, record the highest close of the squeeze period.
  if (squeeze) {
    st.sqzHigh = st.sqzHigh != null ? Math.max(st.sqzHigh, price) : price;
    st.sqzActive = true;
    return null;
  }
  // Squeeze released: buy only on a close above the squeeze-period high.
  if (st.sqzActive && st.sqzHigh != null && price > st.sqzHigh) {
    const qty = (0.9 * ctx.cash) / price * 0.99;
    st.peak = price; st.entry = price; st.sqzActive = false; st.sqzHigh = null;
    return { side: 'buy', qty: qty };
  }
  st.sqzActive = false; st.sqzHigh = null;
  return null;
}
