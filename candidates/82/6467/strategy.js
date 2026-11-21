/*
 * @coinsori-strategy v1
 * name: BTC Crash-Avoid Trend-Hold 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a long-only strategy that stays in BTC through up-trends and
 * steps out only on a CONFIRMED breakdown, so it captures most of bull moves while
 * avoiding the worst of bear crashes. The asymmetric speeds are the whole point:
 * a fast 50-bar EMA re-entry buys dips in an uptrend (which can beat holding),
 * and a slow confirmed exit (200-bar EMA + RSI) holds normal pullbacks.
 * When it buys and sells: buys when the 4h close is back above its 50-bar EMA
 * (quick re-entry after any pullback or crash). Sells when the close drops below
 * the 200-bar EMA AND RSI(14) is below 45 (a confirmed breakdown, not a normal
 * dip), or when price falls 4x ATR below entry (crash cap).
 * When it does NOT work: in a long choppy sideways market the fast entry and slow
 * exit whipsaw and pay fees while price goes nowhere; and in a V-shaped crash-and-
 * recover (like March 2020) the exit-then-re-entry costs a slice of the recovery
 * versus simply holding.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  if (ema50 == null || ema200 == null) {
    ctx.watch([]);
    return null;
  }
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);

  const watch = [];

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    let stop = null;
    // wide crash cap (4xATR): cut catastrophic moves, ignore normal noise
    if (entryPx != null && atr != null) stop = entryPx - 4 * atr;
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR crash stop' });
    watch.push({ side: 'sell', price: ema200, trigger: 'below', note: 'close<EMA200 + RSI<45', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 45, closed: true }
    ]});
    ctx.watch(watch);
    if (prevClose != null && prevClose < ema200 && rsi != null && rsi < 45) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // flat: re-enter as soon as the close is back above the fast trend line
  watch.push({ side: 'buy', price: ema50, trigger: 'above', note: 'close back > EMA50' });
  ctx.watch(watch);
  if (prevClose != null && prevClose > ema50) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
