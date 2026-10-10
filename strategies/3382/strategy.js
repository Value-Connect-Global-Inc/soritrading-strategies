/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 UpperHalf Regime 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 baseline beats buy-and-hold on all three 1d windows,
 * but it still takes breakouts from the lower half of the range, which are often bounces inside
 * a downtrend (bear traps). This variant only buys a 55-day breakout when the market is already
 * in the UPPER half of its 55-day range — a regime filter that is different from the 200d EMA
 * filter already tested and rejected. A breakout from the upper half confirms an ongoing up-move
 * rather than a dead-cat bounce.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars AND that close
 * is at or above the midpoint of the 55-day range. Sells when a closed bar closes below the
 * lowest 10 bars, or price falls 2x ATR below entry.
 * When it does NOT work: In a long range where every breakout is a trap it still gets stopped.
 * It never shorts, so a multi-year bear is flat. A violent crash gaps through the ATR stop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const channelLow55 = Math.min(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  // Regime filter: only enter when the breakout close sits in the upper half of the 55-day range.
  // A breakout from the lower half is usually a bounce inside a downtrend, not a trend start.
  const upperHalf = prevClose >= (channelHigh + channelLow55) / 2;
  if (breakout && upperHalf && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
