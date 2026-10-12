/*
 * @coinsori-strategy v1
 * name: DonchianBreakout200SMA
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a new
 * multi-week high and keeps going. This is the classic Turtle/Donchian momentum system
 * plus the textbook Turtle 200-day trend filter: only buy breakouts in an established
 * uptrend, so failed breakouts in bear markets are skipped.
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high AND above the 200-day average; sells on a 20-day low or a hard 2x ATR stop below entry.
 * When it does NOT work: in a sideways market the 55-day high is hit repeatedly and each
 * breakout fails (whipsaw), and the 20-day low exit gives back part of every move — so
 * flat markets are its enemy. The 200-day filter only changes WHEN it buys, not the exits,
 * so it cannot fix the give-back on exits.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);     // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);     // trend filter, closed bar
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0 || sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: exitLow, trigger: 'below', note: '20d low exit' }]);
    return null;
  }

  if (prevClose > entryHigh && prevClose > sma200) {
    // Fresh 55-day high in an uptrend = the start of a sustained move, not chop — full position.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
