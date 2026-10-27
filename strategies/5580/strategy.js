/*
 * @coinsori-strategy v1
 * name: BTC GoldenCross F&G-Filtered 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated BTC golden-cross trend system enters on a cross,
 * which often happens only after a big rally when the crowd is already euphoric —
 * those late entries are the worst ones. The Fear & Greed index is a crypto-native
 * sentiment gauge, so skipping entries taken while the index is at/above 60 avoids
 * buying into euphoria. Keeps the proven signal and stop; adds one sentiment filter.
 * When it buys and sells: Buys on the 50d EMA crossing above the 200d SMA (closed
 * bars) with price above the 200d SMA AND the Fear & Greed index below 60. Sells on
 * the death cross or when price closes 3xATR below the highest close since entry.
 * When it does NOT work: Same whipsaw as any trend follower in sideways markets;
 * and if the index stays at/above 60 for a long time (a persistent euphoric bull),
 * the filter blocks entries and the strategy misses the move entirely.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data("fear_greed"); // sentiment gauge, null until first value
  if (ema50 == null || sma200 == null || atr == null || atr <= 0) return null;

  const prevClose = closes.at(-2);
  const ema50Prev = ctx.ema(50, 2);
  const sma200Prev = ctx.sma(200, 2);

  if (pos != null && pos > 0) {
    let st = ctx.state || {};
    if (typeof st.hi !== 'number') st.hi = prevClose;
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr;
    const deathCross = ema50Prev != null && sma200Prev != null && ema50Prev > sma200Prev && ema50 <= sma200;
    if (deathCross || prevClose < trailStop) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 3xATR' },
                 { side: 'sell', note: 'death cross' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const goldenCross = ema50Prev != null && sma200Prev != null && ema50Prev <= sma200Prev && ema50 > sma200;
  // F&G < 60 = not euphoric yet; we skip entries taken while the crowd is greedy.
  // The champion entered late near tops; this filter targets that known weakness.
  if (goldenCross && prevClose > sma200 && fg != null && fg < 60) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state = { hi: prevClose };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'golden cross, F&G<60',
                 conds: [{ label: 'F&G index', now: fg, op: '<', ref: 60, closed: true }] }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
