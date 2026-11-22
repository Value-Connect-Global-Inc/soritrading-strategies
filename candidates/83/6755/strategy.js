/*
 * @coinsori-strategy v1
 * name: BTC Dual-Direction Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: BTC trends on 4h; breakout entries catch both up and down trends, and shorting lets falling periods earn instead of sitting flat.
 * When it buys and sells: buys only when price closes above the 20-bar high AND price is above SMA(100); shorts only when it closes below the 20-bar low AND price is below SMA(100). Exits on the opposite 10-bar breakout or a hard ATR stop-loss.
 * When it does NOT work: in choppy, range-bound markets breakouts whipsaw and it takes many small losses; the trend filter also keeps it flat during long sideways drifts.
 */
function onUpdate(ctx) {
  const entryN = 20, exitN = 10, stopMult = 2.5;
  const c = ctx.closes, h = ctx.highs, l = ctx.lows;
  const i = c.length;
  if (i < entryN + 3) return null;

  // closed-bar breakout levels: highest/lowest of the N bars BEFORE the signal bar (no look-ahead, no self-inclusion)
  const prevClose = c[i - 2];
  const highestN = Math.max(...h.slice(i - entryN - 2, i - 2));
  const lowestN = Math.min(...l.slice(i - entryN - 2, i - 2));
  const highestX = Math.max(...h.slice(i - exitN - 2, i - 2));
  const lowestX = Math.min(...l.slice(i - exitN - 2, i - 2));

  const atr = ctx.atr(14, 1);
  const sma = ctx.sma(100, 1);
  if (atr == null || sma == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // trend filter: only trade breakouts in the direction of the prevailing trend — counter-trend breakouts whipsaw
  const uptrend = prevClose > sma;
  const downtrend = prevClose < sma;
  const longEntry = uptrend && prevClose > highestN;
  const shortEntry = downtrend && prevClose < lowestN;
  const longExit = prevClose < lowestX;
  const shortExit = prevClose > highestX;

  // hard stop: 2.5 ATR from entry — room above noise, but caps loss per trade
  const longStop = entryPx != null ? entryPx - stopMult * atr : null;
  const shortStop = entryPx != null ? entryPx + stopMult * atr : null;

  const canEnter = ctx.alloc.status === 'ok';
  const qty = () => (ctx.cash / price) * 0.98; // ~1x notional, honest drawdown
  const orders = [];

  if (pos > 0) {
    if (shortEntry && canEnter) {
      // flip long -> short
      orders.push({ side: 'sell', qty: pos, reduceOnly: true });
      orders.push({ side: 'sell', qty: qty() });
    } else if (longExit) {
      orders.push({ side: 'sell', qty: pos, reduceOnly: true });
    } else if (longStop != null && price <= longStop) {
      orders.push({ side: 'sell', qty: pos, reduceOnly: true });
    }
  } else if (pos < 0) {
    if (longEntry && canEnter) {
      // flip short -> long
      orders.push({ side: 'buy', qty: -pos, reduceOnly: true });
      orders.push({ side: 'buy', qty: qty() });
    } else if (shortExit) {
      orders.push({ side: 'buy', qty: -pos, reduceOnly: true });
    } else if (shortStop != null && price >= shortStop) {
      orders.push({ side: 'buy', qty: -pos, reduceOnly: true });
    }
  } else {
    if (longEntry && canEnter) orders.push({ side: 'buy', qty: qty() });
    else if (shortEntry && canEnter) orders.push({ side: 'sell', qty: qty() });
  }

  // declare every entry/exit level we are waiting for
  const watch = [
    { side: 'buy', price: highestN, trigger: 'above', note: '20-bar high breakout' },
    { side: 'sell', price: lowestN, trigger: 'below', note: '20-bar low breakout' },
    { side: 'sell', price: lowestX, trigger: 'below', note: '10-bar low exit' },
    { side: 'buy', price: highestX, trigger: 'above', note: '10-bar high exit' }
  ];
  if (longStop != null) watch.push({ side: 'sell', price: longStop, trigger: 'below', note: 'ATR stop' });
  if (shortStop != null) watch.push({ side: 'buy', price: shortStop, trigger: 'above', note: 'ATR stop' });
  ctx.watch(watch);

  return orders.length ? orders : null;
}
