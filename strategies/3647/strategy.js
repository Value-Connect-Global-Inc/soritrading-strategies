/*
 * @coinsori-strategy v1
 * name: DonchianBreakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a
 * new multi-week high and keeps going. Entering only on a fresh 55-day high avoids
 * buying into chop and rides the big moves; exiting on a 20-day low cuts the trend
 * before it fully reverses. This is the classic Turtle/Donchian momentum system.
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high; sells when it is a 20-day low, or on a hard 2x ATR stop below entry.
 * When it does NOT work: in a sideways market the 55-day high is hit repeatedly and
 * each breakout fails (whipsaw), and the 20-day low exit gives back part of every
 * move — so flat markets are its enemy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);     // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  if (prevClose > entryHigh) {
    // Fresh 55-day high = the start of a sustained move, not chop — full position.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
