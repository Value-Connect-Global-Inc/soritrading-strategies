/*
 * @coinsori-strategy v1
 * name: BTC Donchian Long/Short 4H USDM
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard in BOTH directions. A long/short turtle
 * rides up-legs long and down-legs short, so it makes money in bear markets
 * too — a return source buy-and-hold does not have.
 * When it buys and sells: buys when price breaks above the 20-bar high, sells
 * when price breaks below the 20-bar low; exits on the opposite 55-bar channel.
 * When it does NOT work: in long sideways chop with no real breakouts it gets
 * whipsawed in and out on both sides and pays fees; a violent gap against the
 * position can hurt because there is no tight stop.
 */
function onUpdate(ctx) {
  const entryN = 20, exitN = 55;   // fast entry / slow exit — classic turtle
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

  // Declare only the levels that can fire right now.
  const watchList = [];
  if (pos === 0) {
    watchList.push(
      { side: 'buy', price: hiEntry, trigger: 'above', note: 'Long 20-bar breakout' },
      { side: 'sell', price: loEntry, trigger: 'below', note: 'Short 20-bar breakdown' }
    );
  } else if (pos > 0) {
    watchList.push({ side: 'sell', price: loExit, trigger: 'below', note: 'Exit long 55-bar low' });
  } else {
    watchList.push({ side: 'buy', price: hiExit, trigger: 'above', note: 'Exit short 55-bar high' });
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
