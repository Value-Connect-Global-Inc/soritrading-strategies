/*
 * @coinsori-strategy v1
 * name: ETH Panic Dip Mean-Reversion 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Sharp crashes in crypto are followed by sharp bounces —
 * prices stretched far below the average tend to snap back. On a 4h clock
 * there are many more panic dips than on daily, so the strategy trades often
 * instead of sitting in cash for months. The hard stop keeps the rare
 * "keeps falling" case bounded.
 * When it buys and sells: Buy when the 4h close is below the lower Bollinger
 * band AND oversold (RSI < 30) AND the market is still in a long-term uptrend
 * (close above the 200-bar average). Sell when the close recovers to the
 * 20-bar average, or cut the loss at 2.5x the 4h ATR below entry.
 * When it does NOT work: In a persistent bear market the 200-bar filter keeps
 * it out of most falling knives, but the dips it still takes can stop out
 * repeatedly. It also does poorly in a low-volatility grind where RSI rarely
 * reaches 30, so it just sits in cash.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (bb == null || bb.lower == null || bb.mid == null || rsi == null || atr == null || sma200 == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    // Stop is 2.5x ATR below entry: bounds a single bad dip.
    const stop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
    const watch = [{ side: 'sell', price: bb.mid, trigger: 'above', note: 'revert to 20-bar avg' }];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' });
    ctx.watch(watch);
    if (prevClose > bb.mid) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && ctx.price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Only catch dips inside a long-term uptrend: in a bear market the average
  // itself keeps falling, so "revert to the average" becomes a falling knife.
  const uptrend = prevClose > sma200;
  const buyWatch = { side: 'buy', price: bb.lower, trigger: 'below', note: 'panic dip in uptrend' };
  buyWatch.conds = [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
    { label: 'above 200-bar avg', ok: uptrend }
  ];
  ctx.watch([buyWatch]);
  if (uptrend && prevClose < bb.lower && rsi < 30) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
