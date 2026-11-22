/*
 * @coinsori-strategy v1
 * name: BTC Book-Spread Pressure 5m
 * ex: binance
 * syms: BTC/USDT
 * interval: 5m
 * cash: 1000
 *
 * Why this strategy: on a liquid market a compressed bid-ask spread together with a
 * heavy bid wall (buy-side depth) often marks a short upward push, and the mirror
 * image marks a drop. We trade that short-term book pressure.
 * When it buys and sells: it buys when the spread is unusually tight (below its own
 * recent average, measured as a z-score) and buy-side depth dominates sell-side;
 * it sells on a take profit, a hard stop, or when the spread has widened back to
 * abnormal (the pressure is gone).
 * When it does NOT work: in thin, quiet hours the book flickers and the signals are
 * noise; in a strong one-way trend the book keeps re-filling against you and the
 * short-term edge is overrun by momentum. Expect small wins, occasional stops, and
 * fee drag on every round trip.
 */

function onUpdate(ctx) {
  if (!ctx.state) ctx.state = {};
  const st = ctx.state;

  const bid = ctx.bid();
  const ask = ctx.ask();
  const mid = ctx.mid();
  if (bid == null || ask == null || mid == null || mid <= 0) return null;
  const spreadPct = (ask - bid) / mid;

  // depth imbalance within 0.25% of mid; treat an unavailable book as neutral
  let imb = null;
  const bidDepth = ctx.depth('bid', mid * 0.9975);
  const askDepth = ctx.depth('ask', mid * 1.0025);
  if (bidDepth != null && askDepth != null) {
    imb = (bidDepth - askDepth) / (bidDepth + askDepth + 1e-12);
  }

  // rolling z-score of the spread, kept in restart-safe state
  if (!st.spreads) st.spreads = [];
  st.spreads.push(spreadPct);
  if (st.spreads.length > 120) st.spreads.shift();
  if (st.spreads.length < 40) { ctx.watch([]); return null; }
  const n = st.spreads.length;
  const avg = st.spreads.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(st.spreads.reduce((a, b) => a + (b - avg) * (b - avg), 0) / n);
  if (sd <= 0) { ctx.watch([]); return null; }
  const z = (spreadPct - avg) / sd;

  const pos = ctx.position || 0;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry * 0.992 : null;  // hard stop 0.8% below entry
    const tpPx = entry != null ? entry * 1.006 : null;    // take profit 0.6% above entry
    const watch = [];
    if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 0.8%' });
    if (tpPx != null) watch.push({ side: 'sell', price: tpPx, trigger: 'above', note: 'take profit 0.6%' });
    watch.push({ side: 'sell', price: price, trigger: 'above', note: 'spread re-widened', conds: [{ label: 'spread z', now: z, op: '>', ref: 1, closed: false }] });
    ctx.watch(watch);
    if (stopPx != null && price <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (tpPx != null && price >= tpPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (z > 1) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // entry: unusually tight spread; buy-side pressure when the book is visible
  const buyPressure = (imb == null) || (imb > 0.2);
  if (z < -1 && buyPressure) {
    const qty = (ctx.cash / price) * 0.5;
    const conds = [{ label: 'spread z', now: z, op: '<', ref: -1, closed: false }];
    if (imb != null) conds.push({ label: 'bid imbalance', now: imb, op: '>', ref: 0.2, closed: false });
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'book pressure buy', conds: conds }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
