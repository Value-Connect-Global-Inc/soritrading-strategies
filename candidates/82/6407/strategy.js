/*
 * @coinsori-strategy v1
 * name: BTC Donchian Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard; a turtle-style breakout rides up-legs
 * and a slow exit lets a winning trend run. A hard ATR stop caps the loss on
 * any single failed breakout.
 * When it buys and sells: buys when price breaks above the 20-bar high while
 * the 200-bar average is still rising; sells when price breaks below the
 * 55-bar low, or on a hard 4xATR stop from entry.
 * When it does NOT work: in long sideways chop with no real breakouts it gets
 * whipsawed in and out and pays fees; in a falling market the trend filter
 * keeps it in cash.
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
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;

  if (pos > 0) {
    // Hard stop: 4x ATR below entry — caps the loss on a failed breakout.
    const stopPx = ctx.entryPx != null ? ctx.entryPx - 4 * atr : null;
    ctx.watch([
      { side: 'sell', price: loExit, trigger: 'below', note: 'Exit 55-bar low' },
      { side: 'sell', price: stopPx != null ? stopPx : loExit, trigger: 'below', note: '4xATR stop' }
    ]);
    if (price < loExit || (stopPx != null && price < stopPx)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Only buy when the 200-bar trend is rising — avoids bear-market dead-cat breakouts.
  const uptrend = sma200 > sma200prev;
  const buy = uptrend && price > hiEntry;
  ctx.watch([
    { side: 'buy', price: hiEntry, trigger: 'above', note: '20-bar breakout', conds: [{ label: 'SMA200 rising', ok: uptrend }] }
  ]);
  if (buy) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  return null;
}
