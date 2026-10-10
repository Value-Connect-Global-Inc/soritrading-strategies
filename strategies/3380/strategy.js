/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 NoFilter Baseline 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Baseline copy of the pre-filter ADA Donchian 55/10 breakout (cycle 7's
 * adopted strategy 3379) kept as a separate strategy so the trend-filtered version can be
 * compared on IDENTICAL windows. No 200d EMA filter.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells
 * when a closed bar closes below the lowest 10 bars, or price falls 2x ATR below entry.
 * When it does NOT work: In a long range where every 55-day breakout is a bull trap it gets
 * stopped out repeatedly. It never shorts, so a multi-year bear is just flat.
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
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
