/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: after a sharp, fast drop Bitcoin tends to bounce back
 * toward its recent average — mean reversion. This is the opposite of trend
 * following: it buys fear and sells recovery, so it profits in a different
 * regime (sharp dips that snap back) than a trend filter.
 * When it buys and sells: Buys BTC when the close is far below its 30-day
 * average (a deep pullback, measured as a z-score) AND the 14-day RSI is
 * deeply oversold. Sells to cash when the price recovers back up to the
 * 30-day average. No other exit.
 * When it does NOT work: in a steady one-way crash (no snap-back) it catches
 * falling knives and loses; and in a long quiet uptrend with few deep dips it
 * stays flat and misses the rise. It needs volatility and reversals to win.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  // 30-day mean and z-score of the close (closed bar, no look-ahead)
  const mean = ctx.sma(30, 1);
  const sd = ctx.stdev(30, 1);
  const rsi = ctx.rsi(14, 1);
  if (mean == null || sd == null || sd <= 0 || rsi == null) { ctx.watch([]); return null; }

  const close = ctx.closes.at(-2);
  const z = (close - mean) / sd; // how far the close is below its 30d average, in std devs

  // a deep pullback: close more than 2 std devs below its 30d average
  const deepDip = z <= -2.0;
  // deeply oversold momentum
  const oversold = rsi <= 30;

  const recoverAbove = mean; // exit once price climbs back to the 30d average

  ctx.watch([
    { side: 'buy', price: mean - 2 * sd, trigger: 'below', note: 'deep pullback -> buy', conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }] },
    { side: 'sell', price: recoverAbove, trigger: 'above', note: 'recover to mean -> cash' }
  ]);

  // demoted / not-ok allocation: close any position in an orderly way, no new entries
  if (ctx.alloc) {
    if (ctx.alloc.status === 'demoted' && pos !== 0) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    if (ctx.alloc.status !== 'ok') return null;
  }

  // exit: holding and price recovered up to the 30d average
  if (pos !== 0 && close >= recoverAbove) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }

  // entry: flat, deep pullback and oversold
  if (pos === 0 && deepDip && oversold) {
    const qty = (ctx.cash * 0.95) / price;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
