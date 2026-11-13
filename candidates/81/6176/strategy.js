/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend + VIX Panic Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the edge depends on the regime. In an uptrend the edge is simply
 * holding. In a downtrend the edge is buying the panic dip when the VIX index spikes far
 * above its own recent range and price has fallen below its short mean, then selling the
 * bounce. This is a regime filter, not a single signal.
 * When it buys and sells: buys and holds while price is above its 200-bar average; in a
 * downtrend it buys only when VIX is at least 1.5 standard deviations above its own
 * history and price is below its 100-bar average, and sells when price climbs back to
 * that average or drops 15% below the entry price.
 * When it does NOT work: a choppy sideways market that whipsaws the 200-bar trend line
 * (buys high, sells low repeatedly), and a panic that keeps deepening so each dip keeps
 * falling and every reversion is a loss.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base.vix");
  const pos = ctx.position || 0;
  const st = ctx.state;

  // VIX history for the z-score; dedupe because the daily print repeats across 4h bars
  if (vix != null) {
    if (!Array.isArray(st.vixHist)) st.vixHist = [];
    if (st.vixHist[st.vixHist.length - 1] !== vix) st.vixHist.push(vix);
    if (st.vixHist.length > 120) st.vixHist.shift();
  }

  const sma100 = ctx.sma(100, 1); // short mean on closed bars (~16 days on 4h)
  const sma200 = ctx.sma(200, 1); // trend line on closed bars (~33 days on 4h)
  if (sma100 == null || sma200 == null) return null;
  const price = ctx.price;

  // trend regime: uptrend = price above the 200-bar average
  const uptrend = price > sma200;

  // VIX z-score vs its own history, only after ~2 months of distinct daily prints
  let vz = null;
  if (vix != null && Array.isArray(st.vixHist) && st.vixHist.length >= 60) {
    const mean = st.vixHist.reduce((a, b) => a + b, 0) / st.vixHist.length;
    const sd = Math.sqrt(st.vixHist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / st.vixHist.length);
    vz = sd > 0 ? (vix - mean) / sd : 0;
  }

  if (pos > 0) {
    if (st.mode === 'trend') {
      // hold the uptrend; the trend line is the exit (a crash falls through it anyway)
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend broke' }]);
      if (price < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    } else {
      // panic dip: sell the bounce back to the 100-bar mean, or the 15% hard stop
      if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) * 0.85;
      ctx.watch([
        { side: 'sell', price: sma100, trigger: 'above', note: 'revert to 100-bar mean' },
        { side: 'sell', price: st.stop, trigger: 'below', note: 'hard stop' }
      ]);
      if (price >= sma100 || price <= st.stop) return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  st.stop = null;
  if (uptrend) {
    st.mode = 'trend'; // in an uptrend the edge is holding, so go long
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend hold' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  st.mode = 'panic'; // in a downtrend the edge is only the panic bounce
  ctx.watch([{ side: 'buy', price: sma100, trigger: 'below', note: 'panic dip below 100-bar mean',
              conds: [{ label: 'VIX z-score', now: vz, op: '>=', ref: 1.5 }] }]);
  if (vz != null && vz >= 1.5 && price < sma100) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
