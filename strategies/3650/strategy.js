/*
 * @coinsori-strategy v1
 * name: DonchianBreakoutVol
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a
 * new multi-week high and keeps going. A breakout on above-average volume is more
 * likely to follow through than one on thin volume, so we only enter when the
 * breakout bar trades more than the recent average.
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high AND that bar's volume is above its 20-bar average; sells on a 20-day low or a
 * hard 2x ATR stop below entry.
 * When it does NOT work: in a sideways market breakouts still whipsaw, and the 20-day
 * low exit gives back part of every move; a low-volume breakout that DOES follow
 * through is missed by the volume filter.
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
    // Volume confirmation: the breakout bar's volume (closed bar) must exceed the
    // 20-bar average before it. Standard rule — high-volume breakouts follow through.
    const vols = ctx.volumes;
    if (vols && vols.length >= 22) {
      const prevVol = vols.at(-2);
      let sum = 0;
      for (let i = vols.length - 3; i >= vols.length - 22; i--) sum += vols[i];
      const avg = sum / 20;
      if (prevVol > avg) {
        ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
        return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
      }
    }
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
