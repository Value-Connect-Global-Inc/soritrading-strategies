/*
 * @coinsori-strategy v1
 * name: SOL ROC Momentum Trend 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Rate-of-change (ROC) momentum is a different signal family
 * from Donchian/Ichimoku — it measures the strength of the move itself, not a
 * price level. SOL trends harder than most alts and its 1d data is rich. The
 * rule is simple and robust: enter when 30-day momentum turns positive, ride the
 * trend with a trailing ATR stop, and never trade without a hard stop.
 * When it buys and sells: buys when a closed bar's 30-day ROC crosses above zero
 * (momentum turned positive). Sells when price closes below the 10-day low, or
 * falls 2.5 ATR below entry.
 * When it does NOT work: In a sideways range the ROC oscillates around zero and
 * whipsaws. In a violent crash price gaps through the ATR stop. A slow grinding
 * bull with no pullbacks gives few clean entries.
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

  // 30-day ROC of the last closed bar vs the close 30 bars before it.
  const rocNow = closes.at(-2) / closes.at(-32) - 1;
  const rocPrev = closes.at(-3) / closes.at(-33) - 1;
  if (!Number.isFinite(rocNow) || !Number.isFinite(rocPrev)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    const channelLow = Math.min(...closes.slice(-12, -2));   // 10-day low exit = trailing stop
    ctx.watch([{ side: 'sell', price: channelLow, trigger: 'below', note: '10-day low trail' },
               { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    if (prevClose < channelLow || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  // Momentum turned positive on a closed bar: enter the new up-leg.
  if (rocPrev <= 0 && rocNow > 0) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
