/*
 * @coinsori-strategy v1
 * name: BTC Oversold Mean-Revert 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * BTC often snaps back after a sharp short-term drop while the long-term
 * trend is still up. We buy oversold dips that happen above the 200-bar
 * trend line and sell when price reverts back to its mean.
 * Works in choppy bull markets. Loses in crashes that break the trend line
 * from above (the stop-loss caps it) and in slow grind-ups with no dips.
 */

function onUpdate(ctx) {
  const z = ctx.zscore(50, 1);      // closed-bar z-score of close vs its 50-bar mean
  const mean = ctx.sma(50, 1);
  const sd = ctx.stdev(50, 1);
  const ema = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.price;

  if (z == null || mean == null || sd == null || ema == null || atr == null) return null;

  if (ctx.position <= 0) {
    // ENTRY: oversold dip, but only inside an uptrend (avoid catching falling knives)
    if (z < -1.5 && px > ema) {
      const entryLevel = mean - 1.5 * sd;   // price level matching the z < -1.5 trigger
      ctx.watch([{
        side: 'buy', price: entryLevel, trigger: 'below', note: 'oversold dip',
        conds: [{ label: 'price>EMA200', ok: px > ema, closed: true }]
      }]);
      const qty = (ctx.cash * 0.95) / px;
      return { side: 'buy', qty: qty };
    }
    ctx.watch([]);
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) { ctx.watch([]); return null; }

  const revertLevel = mean + 0.3 * sd;      // sell once price is back above the mean
  const stop = entry - 2.5 * atr;           // hard stop: 2.5 ATR below entry
  ctx.watch([
    { side: 'sell', price: revertLevel, trigger: 'above', note: 'reverted to mean' },
    { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' },
    { side: 'sell', price: ema, trigger: 'below', note: 'trend broke' }
  ]);

  if (px >= revertLevel || px <= stop || px < ema) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
