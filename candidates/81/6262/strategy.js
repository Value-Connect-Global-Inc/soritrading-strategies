/*
 * @coinsori-strategy v1
 * name: BTC Z-Score Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Mean reversion — crypto overreacts to news, so sharp deviations from
 * a slow-moving average tend to snap back. This buys BTC when its price is stretched far
 * below its own 200-day average (extreme oversold) and sells when it reverts to the mean.
 * A hard stop caps the downside if the deviation keeps growing (a real crash, not a dip).
 * When it buys and sells: buy when the 1-day close is more than 1.5 standard deviations
 * below its 200-day mean (z-score < -1.5). Sell when it returns to within 0.5 std of the
 * mean, or when the 2.5x ATR stop is hit.
 * When it does NOT work: in a genuine long bear market (2018, 2022) price can stay far
 * below the mean for months — the stop fires repeatedly and it bleeds; it also sits in
 * cash most of the time and misses the bulk of bull-market gains.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const z = ctx.zscore(200, 1);
  const atr = ctx.atr(14, 1);
  if (z == null || atr == null) { ctx.watch([]); return null; }
  const close = ctx.closes.at(-2);

  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
    const reverted = z > -0.5; // back near the mean → take the mean reversion profit
    if (reverted || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'revert/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '2.5x ATR stop' }]);
    return null;
  }

  if (z < -1.5) { // stretched far below the mean → oversold, expect a snap back
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'below', note: 'deep oversold', conds: [{ label: 'z-score(200)', now: z, op: '<', ref: -1.5, closed: true }] }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
