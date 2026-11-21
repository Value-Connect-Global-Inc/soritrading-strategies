/*
 * @coinsori-strategy v1
 * name: BTC Slow Regime Trend Ride 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin alternates between long trends and sharp
 * reversals. A slow regime filter holds through up-trends and steps aside in
 * down-trends; a wide trailing stop caps crash drawdown; and the entry only
 * fires on a confirmed sustained uptrend, so the strategy does not buy back
 * into a dead-cat bounce or a bear-market rally.
 * When it buys and sells: Buy when the close is above the 200-period average
 * and the 50-period average has been above the 200-period average for the
 * last 10 bars (confirmed sustained uptrend). Sell when the 50-period
 * average falls below the 200-period average (the trend has truly turned) OR
 * falls 35% below the highest close since entry (crash backstop).
 * When it does NOT work: In a long sideways market the filter whipsaws and
 * pays fees on false trend flips. It only re-enters after a confirmed
 * uptrend rebuilds, so it misses the very start of a recovery after a crash.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema200_10 = ctx.ema(200, 11);
  if (ema50 == null || ema200 == null || ema200_10 == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  if (pos > 0) {
    // Track the highest close since entry to build the crash backstop.
    let peak = ctx.state.peak;
    if (peak == null || prevClose > peak) peak = prevClose;
    ctx.state.peak = peak;

    // Exit when the trend truly turns: EMA50 crosses below EMA200.
    const trendBreak = ema50 < ema200;
    // 35% crash backstop: only binds in a fast crash the slow EMAs miss.
    const stopPct = 0.35;
    const stop = peak * (1 - stopPct);
    const stopHit = prevClose < stop;

    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'regime flip (ema50<ema200)' },
      { side: 'sell', price: stop, trigger: 'below', note: 'crash backstop' }
    ]);
    if (trendBreak || stopHit) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  // Sustained uptrend: close above 200, and 50 above 200 both now and 10 bars ago.
  const uptrend = prevClose > ema200 && ema50 > ema200 && ema50 > ema200_10;
  const buyLevel = ema200;

  ctx.watch([{
    side: 'buy', price: buyLevel, trigger: 'above', note: 'confirmed uptrend',
    conds: [
      { label: 'ema50>ema200', ok: ema50 > ema200 },
      { label: 'ema50>ema200 10b', ok: ema50 > ema200_10 }
    ]
  }]);
  if (uptrend) {
    ctx.state.peak = null; // fresh entry: reset the crash backstop peak
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
