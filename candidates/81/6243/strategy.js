/*
 * @coinsori-strategy v1
 * name: BTC Z-Score Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Prices revert to their own mean after sharp moves. A very negative
 * z-score (price far below its recent average) marks an oversold snap that often bounces.
 * This is a mean-reversion bet, the opposite family from trend-following.
 * When it buys and sells: buy when the 60-bar z-score drops below -2.5 (deep oversold) while
 * price is still above its EMA200 (long-term uptrend intact, avoiding catching a knife in a
 * true bear). Exit when z-score rises back above 0 (reversion complete) or the 3x ATR stop
 * is hit. Long-only spot.
 * When it does NOT work: in a genuine crash the z-score stays deeply negative and price never
 * reverts — the stop takes repeated losses; in a calm grind the z-score never reaches -2.5 so
 * it just sits in cash.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const z = ctx.zscore(60, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (z == null || ema200 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);

  // ---- exit ----
  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    const reverted = z >= 0; // price back at/above its mean = reversion done
    if (reverted || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'revert/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  // ---- entry: deep oversold in an uptrend ----
  if (z < -2.5 && close > ema200) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy', price: close, trigger: 'above', note: 'z-score oversold buy',
      conds: [{ label: 'z-score(60)', now: z, op: '<', ref: -2.5, closed: true }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
