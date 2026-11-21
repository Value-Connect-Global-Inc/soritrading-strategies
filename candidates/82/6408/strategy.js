/*
 * @coinsori-strategy v1
 * name: BTC Donchian Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard; a turtle-style breakout rides up-legs
 * and a slow exit lets a winning trend run. The 55-bar low exit is itself the
 * risk control — a hard ATR stop only cuts winners short in normal pullbacks.
 * When it buys and sells: buys when price breaks above the 20-bar high while
 * price is above its 200-bar average; sells only when price breaks below the
 * 55-bar low.
 * When it does NOT work: in long sideways chop with no real breakouts it gets
 * whipsawed in and out and pays fees; in a falling market the level filter
 * keeps it in cash; a single fast crash can give back a large unrealized gain
 * because there is no tight stop.
 */
function onUpdate(ctx) {
  const entryN = 20, exitN = 55;   // fast entry / slow exit — classic turtle
  const highs = ctx.highs, lows = ctx.lows;
  if (highs.length < exitN + 2) return null;

  // Channels built from CLOSED bars only (ago>=1) so live == backtest.
  let hiEntry = -Infinity, loExit = Infinity;
  for (let i = 2; i <= entryN + 1; i++) {
    const h = highs.at(-i);
    if (h > hiEntry) hiEntry = h;
  }
  for (let i = 2; i <= exitN + 1; i++) {
    const l = lows.at(-i);
    if (l < loExit) loExit = l;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: loExit, trigger: 'below', note: 'Exit 55-bar low' }
    ]);
    if (price < loExit) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Only buy above the 200-bar average — avoids bear-market dead-cat breakouts.
  const buy = price > sma200 && price > hiEntry;
  ctx.watch([
    { side: 'buy', price: hiEntry, trigger: 'above', note: '20-bar breakout', conds: [{ label: 'Price>SMA200', ok: price > sma200 }] }
  ]);
  if (buy) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  return null;
}
