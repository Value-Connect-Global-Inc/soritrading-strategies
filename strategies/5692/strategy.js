/*
 * @coinsori-strategy v1
 * name: BTC Dip-Buy RSI2 Uptrend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a long-term Bitcoin uptrend, sharp short-term dips are usually bought back quickly (mean reversion), not the start of a new bear market. Buying extreme short-term oversold readings inside a 200-day uptrend captures these recoveries.
 * When it buys and sells: It buys when price is above its 200-day average AND the 2-day RSI is below 15 (a sharp dip). It sells when price closes back above its 20-day average (dip recovered), closes below the 200-day average (uptrend over), or falls 20% below entry.
 * When it does NOT work: In a bear market price stays below the 200-day average so it never buys (safe but flat). In a crash that keeps falling, the 20% stop limits damage but the RSI dip keeps re-firing and the strategy can take repeated small losses. In a slow grind up with no sharp dips it stays in cash and misses the move.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma20 = ctx.sma(20, 1);
  const rsi2 = ctx.rsi(2, 1);
  if (sma200 == null || sma20 == null || rsi2 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx != null ? ctx.entryPx * 0.8 : null; // 20% disaster stop
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'dip recovered (SMA20)' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'uptrend broken (SMA200)' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (prevClose > sma20) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend',
      conds: [{ label: 'RSI(2) < 15', now: rsi2, op: '<', ref: 15, closed: true }] }
  ]);
  // Buy a sharp dip only inside a confirmed long-term uptrend
  if (prevClose > sma200 && rsi2 < 15) {
    // 60% of cash per entry; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
