/*
 * @coinsori-strategy v1
 * name: SMA200/50 Trend BTC 1D + ATR buffer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A slow entry + fast exit trend filter is a classic robust design.
 * The 200-day average confirms a healthy uptrend before buying (avoiding false bottoms),
 * while the 50-day average catches tops much sooner than the 200-day, so a bear market
 * is exited long before the slow average would signal. Two guards reduce whipsaw and
 * crash risk: (1) the 50-day exit only fires when the close breaks below it by a full
 * ATR(14), so a mere touch of the line in a chop does not dump the position; (2) a 3x
 * ATR trailing stop from the recent 50-bar peak gives every position a hard stop-loss
 * so a violent crash is cut even before the 50-day exit lags.
 * When it buys and sells: Buy when the daily close crosses back above its 200-day
 * average. Sell when the close breaks below the 50-day average by one ATR, or falls
 * below the trailing stop (50-bar peak minus 3x ATR), whichever comes first.
 * When it does NOT work: In choppy ranges the exits still trigger more than ideal,
 * converting a single hold into several round-trips. It re-enters late after each
 * V-shaped recovery because the 200-day confirmation takes time.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  const sma50 = ctx.sma(50, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || sma200Prev == null || sma50 == null || prevClose == null) return null;

  const pos = ctx.position || 0;

  if (pos === 0) {
    // Slow entry: only buy on a confirmed 200-day crossover above.
    if (prevClose > sma200Prev && ctx.closes.at(-3) <= sma200Prev) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'above 200d avg' }]);
    return null;
  }

  const atr = ctx.atr(14, 1);
  const peak = ctx.high(50, 1);
  if (atr == null || peak == null) return null;

  // 50-day exit needs a full ATR of breakdown, so a noise-level touch does not dump.
  const exit50 = sma50 - atr;
  // Hard stop: trail the recent 50-bar peak by 3x ATR(14) to cut fast crashes.
  const trailStop = peak - 3 * atr;

  ctx.watch([
    { side: 'sell', price: exit50, trigger: 'below', note: 'break 50d by 1 ATR' },
    { side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' }
  ]);
  if (prevClose < exit50 || prevClose < trailStop) return { side: 'sell', qty: pos };
  return null;
}
