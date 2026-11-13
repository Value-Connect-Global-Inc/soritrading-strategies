/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend Core NoGate Baseline
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Baseline control for the funding-gate experiment. Identical
 * EMA50/200 trend core as the funding-gated version but WITHOUT any funding
 * condition, so any difference in results isolates what the funding gate adds.
 * When it buys and sells: Buy when EMA50 > EMA200 and price above EMA50. Sell when
 * the trend breaks or price falls -25% from entry.
 * When it does NOT work: plain trend-following whipsaws in chop and sits out melt-ups
 * it never re-enters.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const trendUp = ema50 > ema200 && prevClose > ema50;
  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (trendUp) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up' }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up' }]);
  return null;
}
