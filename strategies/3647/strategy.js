/*
 * @coinsori-strategy v1
 * name: DonchianBreakoutVolFilter
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a new
 * multi-week high and keeps going. This is the classic Turtle/Donchian momentum system
 * with one extra confirmation: the breakout bar must trade above its recent average
 * volume, which filters out weak breakouts that happen in quiet chop.
 *
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high AND that bar's volume is above the average of the 50 bars before it; sells on a
 * 20-day low or a hard 2x ATR stop below entry.
 *
 * When it does NOT work: in a sideways market the 55-day high is hit repeatedly and each
 * breakout fails (whipsaw), and the 20-day low exit gives back part of every move — so
 * flat markets are its enemy. The volume filter only skips low-volume breakouts; it
 * cannot fix the give-back on exits.
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

  // Volume confirmation: breakout-bar volume vs the average of the 50 bars before it.
  const vols = ctx.volumes;
  if (vols == null || vols.length < 53) return null;
  let vSum = 0;
  for (let i = vols.length - 52; i <= vols.length - 3; i++) vSum += vols[i];
  const avgVol = vSum / 50;
  const breakoutVol = vols[vols.length - 2];
  const volOk = breakoutVol > avgVol;

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

  if (prevClose > entryHigh && volOk) {
    // Fresh 55-day high on above-average volume = a real breakout, not chop.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
