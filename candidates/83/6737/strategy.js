/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * BTC moves in long strong trends. When price closes above the highest high
 * of the last 55 bars a new up-leg is starting, so we buy and ride it until
 * price closes back below the 20-bar low (or a 2.5 ATR stop is hit).
 * Works in trending markets. Loses in long sideways chop where breakouts
 * fail quickly and fees stack up.
 */

function onUpdate(ctx) {
  const closes = ctx.closes;
  const highs = ctx.highs;
  const lows = ctx.lows;
  const atr = ctx.atr(14, 1);
  const px = ctx.price;

  // need at least 55 closed bars before the current one
  if (closes.length < 57 || atr == null) return null;

  const prevClose = closes.at(-2);                       // last CLOSED bar
  const lookbackEnd = closes.length - 2;                 // index of last closed bar
  const hi55 = Math.max(...highs.slice(lookbackEnd - 55, lookbackEnd));
  const lo20 = Math.min(...lows.slice(lookbackEnd - 20, lookbackEnd));

  if (ctx.position <= 0) {
    // ENTRY: a close above the 55-bar high = fresh breakout
    if (prevClose > hi55) {
      ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-bar breakout',
                   conds: [{ label: 'close>55h', now: prevClose, op: '>', ref: hi55, closed: true }] }]);
      return { side: 'buy', qty: (ctx.cash * 0.95) / px };
    }
    ctx.watch([]);
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) { ctx.watch([]); return null; }

  const stop = entry - 2.5 * atr;   // hard stop: 2.5 ATR below entry
  ctx.watch([
    { side: 'sell', price: lo20, trigger: 'below', note: '20-bar breakdown',
      conds: [{ label: 'close<20l', now: prevClose, op: '<', ref: lo20, closed: true }] },
    { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
  ]);

  if (prevClose < lo20 || px <= stop) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
