/*
 * @coinsori-strategy v1
 * name: BTC Bull-Regime Dip Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In established Bitcoin bull markets, sharp dips (price far below its own 20-day average) have historically bounced back to that average within weeks, while bear markets keep falling. This strategy buys those dips only while the long-term trend is still bullish, then sells when price recovers to its average — mean reversion without catching falling knives.
 * When it buys and sells: Buys when the daily close is more than 2 standard deviations below its 20-day average AND the close is still above its 200-day average (bull market). Sells when the close climbs back above its 20-day average, or falls below the 200-day average (the bull regime broke), or drops 20% below the entry (crash insurance).
 * When it does NOT work: In a bear market the 200-day filter keeps it out of the market most of the time, so it makes no money while the market falls. After a bull-market top the first deep dip can keep falling and the stop-loss takes the loss. In a slow grind-down with no sharp dips it never trades.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);   // long-term bull/bear line (1d regime)
  const sma20 = ctx.sma(20, 1);     // short mean-reversion target
  const sd20 = ctx.stdev(20, 1);    // short-term dispersion
  if (prevClose == null || sma200 == null || sma20 == null || sd20 == null) { ctx.watch([]); return null; }

  const dipLine = sma20 - 2 * sd20;  // 2 std dev below the 20-day mean = deep dip
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.80 : null;  // 20% crash insurance, rarely hits
    const prevLow = ctx.lows.at(-2);
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'revert to 20d mean' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'bull regime broke' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: '20% hard stop' }] : [])
    ]);
    if (prevClose > sma20 || prevClose < sma200 || (stop != null && prevLow < stop)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy', price: dipLine, trigger: 'below', note: 'deep dip in bull regime',
    conds: [{ label: 'bull regime', ok: prevClose > sma200 }]
  }]);
  if (prevClose < dipLine && prevClose > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
