/*
 * @coinsori-strategy v1
 * name: BTC Slow Turtle Long/Short 4H USDM
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard in BOTH directions and a slow turtle
 * rides the whole leg. The entry is a 20-day breakout and the exit is a
 * 33-day channel — slow enough to survive normal pullbacks. Shorting gives
 * it a return source buy-and-hold does not have in bear markets.
 * When it buys and sells: buys above the 120-bar high, sells below the
 * 120-bar low; exits on the opposite 200-bar channel.
 * When it does NOT work: in long sideways chop with no real breakouts it stays
 * flat (safe but boring); a violent gap against the position can hurt because
 * there is no tight stop.
 */
function onUpdate(ctx) {
  const entryN = 120, exitN = 200;   // 20-day entry / 33-day exit on 4h
  const highs = ctx.highs, lows = ctx.lows;
  if (highs.length < exitN + 2) return null;

  // Channels built from CLOSED bars only (ago>=1) so live == backtest.
  let hiEntry = -Infinity, loEntry = Infinity, hiExit = -Infinity, loExit = Infinity;
  for (let i = 2; i <= entryN + 1; i++) {
    const h = highs.at(-i), l = lows.at(-i);
    if (h > hiEntry) hiEntry = h;
    if (l < loEntry) loEntry = l;
  }
  for (let i = 2; i <= exitN + 1; i++) {
    const h = highs.at(-i), l = lows.at(-i);
    if (h > hiExit) hiExit = h;
    if (l < loExit) loExit = l;
  }

  const price = ctx.price;
  const pos = ctx.position || 0;

  const watchList = [];
  if (pos === 0) {
    watchList.push(
      { side: 'buy', price: hiEntry, trigger: 'above', note: 'Long 120-bar breakout' },
      { side: 'sell', price: loEntry, trigger: 'below', note: 'Short 120-bar breakdown' }
    );
  } else if (pos > 0) {
    watchList.push({ side: 'sell', price: loExit, trigger: 'below', note: 'Exit long 200-bar low' });
  } else {
    watchList.push({ side: 'buy', price: hiExit, trigger: 'above', note: 'Exit short 200-bar high' });
  }
  ctx.watch(watchList);

  // Manage an open position first.
  if (pos > 0) {
    if (price < loExit) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    if (price > hiExit) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // Flat: enter on a breakout. ~0.5x notional so a wipeout needs a huge move.
  const qty = (ctx.cash / price) * 0.5;
  if (price > hiEntry) return { side: 'buy', qty };
  if (price < loEntry) return { side: 'sell', qty };
  return null;
}
