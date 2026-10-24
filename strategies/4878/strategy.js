/*
 * @coinsori-strategy v1
 * name: SMA200/50 Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A slow entry + fast exit trend filter is a classic robust design.
 * The 200-day average confirms a healthy uptrend before buying (avoiding false bottoms),
 * while the 50-day average catches tops much sooner than the 200-day, so a bear market
 * is exited long before the slow average would signal.
 * When it buys and sells: Buy when the daily close crosses back above its 200-day
 * average AND the 50-day average is above the 200-day (both averages aligned = confirmed
 * uptrend). Sell when the daily close falls back below its 50-day average.
 * When it does NOT work: In choppy ranges the 50-day exit triggers often, converting
 * what would be a single hold into many small round-trips. It also re-enters late after
 * each V-shaped recovery because the 200-day confirmation takes time.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  const sma50 = ctx.sma(50, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || sma200Prev == null || sma50 == null || prevClose == null) return null;

  const pos = ctx.position || 0;

  if (pos === 0) {
    // Slow entry: 200-day crossover above, plus the 50-day already above the 200-day
    // (alignment filter cuts re-entry whipsaws right after a death cross).
    const aligned = sma50 > sma200;
    if (prevClose > sma200Prev && ctx.closes.at(-3) <= sma200Prev && aligned) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'above 200d avg' }]);
    return null;
  }

  // Fast exit: leave when the close drops below the 50-day average, well before the 200d.
  ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'below 50d avg' }]);
  if (prevClose < sma50) return { side: 'sell', qty: pos };
  return null;
}
