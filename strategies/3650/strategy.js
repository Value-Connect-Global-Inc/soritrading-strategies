/*
 * @coinsori-strategy v1
 * name: DonchianBreakoutTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a
 * new multi-week high and keeps going. But a breakout only follows through when the
 * longer-term trend is up, so we only take breakouts while price is above the 200-day
 * average. This is the classic Turtle/Donchian system plus the Turtle trend filter.
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high AND above the 200-day average; sells on a 20-day low or a hard 2x ATR stop.
 * When it does NOT work: in a sideways market above the 200-day average breakouts
 * still whipsaw, and the 20-day low exit gives back part of every move; it also
 * misses the early stage of a reversal that starts below the 200-day average.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);     // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 2);     // closed bar, same bar as the breakout signal
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) return null;
  if (sma200 == null) return null;    // no trend filter until 200 bars exist
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

  // Turtle trend filter: only enter breakouts when price is above the 200-day average.
  // Breakouts in a downtrend are noise and whipsaw; in an uptrend they follow through.
  if (prevClose > entryHigh && prevClose > sma200) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
