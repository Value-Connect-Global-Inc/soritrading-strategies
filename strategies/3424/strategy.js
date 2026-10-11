/*
 * @coinsori-strategy v1
 * name: LINK Donchian Breakout 4H
 * ex: binance
 * syms: LINKUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: strong trends in altcoins often start with a clean break above the recent
 * 20-bar high; riding the trend until price breaks the 20-bar low captures the move.
 * When it buys and sells: buys when price closes above the highest high of the last 20 bars; sells
 * when price falls below the lowest low of the last 20 bars or hits a 2xATR stop.
 * When it does NOT work: in choppy sideways markets it gets whipsawed on both sides; in slow
 * grinding markets the breakout is often a false start.
 */
function onUpdate(ctx) {
  const hi = ctx.high(20, 1);
  const lo = ctx.low(20, 1);
  const atr = ctx.atr(14, 1);
  if (hi == null || lo == null || atr == null) return null;

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2 * atr; // safety net: cap any single loss at ~2xATR
    ctx.watch([
      { side: 'sell', price: lo, trigger: 'below', note: 'channel exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }
    ]);
    if (ctx.price < lo) return { side: 'sell', qty: ctx.position };
    if (ctx.entryPx != null && ctx.price < stopPx) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi, trigger: 'above', note: '20-bar breakout' }]);
  if (ctx.price > hi) return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  return null;
}
