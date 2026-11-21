/*
 * @coinsori-strategy v1
 * name: BTC Slow Donchian Turtle 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard and a slow turtle rides the whole leg.
 * Entry on a 20-day (120-bar) high breakout, exit on a 55-day (330-bar) low —
 * slow enough to survive every normal pullback inside a bull run, so a
 * winning trend is held instead of being shaken out. A 200-bar average gate
 * keeps it out of bear-market dead-cat breakouts.
 * When it buys and sells: buys when price breaks the 120-bar high while price
 * is above the 200-bar average; sells when price breaks below the 330-bar low.
 * When it does NOT work: in long sideways chop it stays in cash (safe but
 * boring); a violent crash can give back a large unrealized gain because
 * there is no tight stop.
 */
function onUpdate(ctx) {
  const entryN = 120, exitN = 330;   // 20-day entry / 55-day exit on 4h
  const highs = ctx.highs, lows = ctx.lows;
  if (highs.length < exitN + 2) return null;

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
    ctx.watch([{ side: 'sell', price: loExit, trigger: 'below', note: 'Exit 330-bar low' }]);
    if (price < loExit) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const buy = price > sma200 && price > hiEntry;
  ctx.watch([{ side: 'buy', price: hiEntry, trigger: 'above', note: '120-bar breakout', conds: [{ label: 'Price>SMA200', ok: price > sma200 }] }]);
  if (buy) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  return null;
}
