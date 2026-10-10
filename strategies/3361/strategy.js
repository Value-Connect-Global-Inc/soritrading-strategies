/*
 * @coinsori-strategy v1
 * name: BTC Dual-Momentum Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A trend is only trustworthy when several time horizons agree. BTC is
 * bought only when the 20-day AND 60-day momentum are both positive and price is above the
 * 200-day average — a confirmed uptrend. It exits when the 20-day momentum genuinely turns
 * (falls below -5%, a real turn rather than a normal pullback), when price falls 25% below
 * the highest close since entry (trailing stop that caps a crash), or when the close breaks
 * the 200-day average. BTC's trends are cleaner than SOL's, so the momentum exit whipsaws
 * less than it did on SOL.
 * When it buys and sells: Buys when the daily close is above the 200-day average AND both the
 * 20-day and 60-day % change are positive. Sells when the 20-day % change falls below -5%,
 * when price falls 25% below the highest close since entry, or when the close falls below the
 * 200-day average.
 * When it does NOT work: In a choppy sideways market the momentum whipsaws and causes repeated
 * small losses. It is late to re-enter after a crash bottom because it waits for all three
 * horizons to agree again.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const lastClose = ctx.closes.at(-2);   // last CLOSED daily bar
  const c20 = ctx.closes.at(-21);        // 20 bars before the closed bar
  const c60 = ctx.closes.at(-61);        // 60 bars before the closed bar
  const sma200 = ctx.sma(200, 1);
  if (lastClose == null || c20 == null || c60 == null || sma200 == null || c20 <= 0 || c60 <= 0) return null;

  const mom20 = lastClose / c20 - 1;   // 20-day momentum (fast trend)
  const mom60 = lastClose / c60 - 1;   // 60-day momentum (slow trend)
  const st = ctx.state;
  const pos = ctx.position;

  if (pos > 0) {
    // Track highest close since entry for the trailing stop.
    if (st.peak == null || lastClose > st.peak) st.peak = lastClose;
    // 25% trailing stop from the peak: wide enough to survive BTC's normal 20-25% bull
    // pullbacks, tight enough to cap a crash. The -5% momentum deadband exits only on a real
    // turn, not on a shallow dip (the <0 exit kicked us out of every strong trend).
    const trail = st.peak * 0.75;
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: '25% trail' },
               { side: 'sell', price: lastClose < sma200 ? price : null, trigger: 'below', note: 'SMA200 break' }]);
    if (mom20 < -0.05 || lastClose < sma200 || price <= trail) {
      st.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (lastClose > sma200 && mom20 > 0 && mom60 > 0) {
    st.entryPx = price;
    st.peak = lastClose;
    const qty = (ctx.cash / price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
