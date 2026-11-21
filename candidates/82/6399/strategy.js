/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle Long/Short 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard in both directions; a turtle-style
 * breakout system rides up-legs long and down-legs short instead of only
 * buying dips. Shorting gives it a return source buy-and-hold does not have.
 * When it buys and sells: buys when price breaks above the 220-bar high,
 * sells when price breaks below the 220-bar low; exits on the opposite
 * 80-bar channel or a 4xATR hard stop.
 * When it does NOT work: in long sideways chop with no real breakouts it
 * gets whipsawed in and out and pays fees on both sides.
 */
function onUpdate(ctx) {
  const entryN = 220, exitN = 80;   // ~37-day entry / ~13-day exit on 4h (classic turtle, scaled)
  const highs = ctx.highs, lows = ctx.lows;
  if (highs.length < entryN + 2) return null;

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

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const price = ctx.price;
  const pos = ctx.position || 0;

  // Hard stop = 4x ATR from entry; unknown until we hold a position.
  const longStop = ctx.entryPx == null ? null : ctx.entryPx - 4 * atr;
  const shortStop = ctx.entryPx == null ? null : ctx.entryPx + 4 * atr;

  // Declare only the levels that can actually fire right now.
  const watchList = [];
  if (pos === 0) {
    watchList.push(
      { side: 'buy', price: hiEntry, trigger: 'above', note: 'Long breakout 220-bar high' },
      { side: 'sell', price: loEntry, trigger: 'below', note: 'Short breakdown 220-bar low' }
    );
  } else if (pos > 0) {
    watchList.push(
      { side: 'sell', price: loExit, trigger: 'below', note: 'Exit long 80-bar low' },
      { side: 'sell', price: longStop, trigger: 'below', note: 'Hard stop long' }
    );
  } else {
    watchList.push(
      { side: 'buy', price: hiExit, trigger: 'above', note: 'Exit short 80-bar high' },
      { side: 'buy', price: shortStop, trigger: 'above', note: 'Hard stop short' }
    );
  }
  ctx.watch(watchList);

  // Manage an open position first: channel exit OR hard stop.
  if (pos > 0) {
    if (price < loExit || (longStop != null && price < longStop)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    if (price > hiExit || (shortStop != null && price > shortStop)) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter on a breakout. ~1x notional; a wipeout needs a full 100% move.
  const qty = (ctx.cash / price) * 0.95;
  if (price > hiEntry) return { side: 'buy', qty };
  if (price < loEntry) return { side: 'sell', qty };
  return null;
}
