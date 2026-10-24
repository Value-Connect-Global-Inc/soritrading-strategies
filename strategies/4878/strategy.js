/*
 * @coinsori-strategy v1
 * name: SMA200/50 Trend BTC 1D + ATR trail
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A slow entry + fast exit trend filter is a classic robust design.
 * The 200-day average confirms a healthy uptrend before buying (avoiding false bottoms),
 * while the 50-day average catches tops much sooner than the 200-day, so a bear market
 * is exited long before the slow average would signal. A 3x ATR(14) trailing stop from
 * the recent 50-bar peak gives every position a hard stop-loss so a fast crash is cut
 * before the 50-day exit lags too far.
 * When it buys and sells: Buy when the daily close crosses back above its 200-day
 * average. Sell when the daily close falls back below its 50-day average OR below the
 * trailing stop (50-bar peak minus 3x ATR), whichever is hit first.
 * When it does NOT work: In choppy ranges the 50-day exit and the trail stop trigger
 * often, converting what would be a single hold into many small round-trips. It also
 * re-enters late after each V-shaped recovery because the 200-day confirmation takes time.
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

  // Hard stop: trail the recent 50-bar peak by 3x ATR(14). 3x is wide enough to
  // avoid normal noise but tight enough to cut a fast crash before the 50-day exit.
  const atr = ctx.atr(14, 1);
  const peak = ctx.high(50, 1);
  if (atr == null || peak == null) return null;
  const trailStop = peak - 3 * atr;

  ctx.watch([
    { side: 'sell', price: sma50, trigger: 'below', note: 'below 50d avg' },
    { side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' }
  ]);
  if (prevClose < sma50 || prevClose < trailStop) return { side: 'sell', qty: pos };
  return null;
}
