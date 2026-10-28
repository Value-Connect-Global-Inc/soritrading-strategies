/*
 * @coinsori-strategy v1
 * name: BTC Fear & Greed Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes — panic (extreme fear) has historically marked BTC bottoms and euphoria (extreme greed) has marked tops, so buying panic and selling once sentiment recovers is a contrarian edge that is the opposite of trend-following.
 * When it buys and sells: It buys when the Fear & Greed index is at or below 20 (extreme fear). It sells when the index recovers to 55 (neutral-to-greed) or when price falls 20% below the entry as a disaster stop.
 * When it does NOT work: In a prolonged bear market extreme fear can persist for months, so each buy can keep losing until the 20% stop hits. It also sits in cash for most of a bull run because it only acts on panic, so it lags buy-and-hold badly in strong one-way markets.
 */
function onUpdate(ctx) {
  const fg = ctx.data("fear_greed");
  if (fg == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // 20% disaster stop below entry — caps damage if a panic buy keeps falling
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null;
    ctx.watch([
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'F&G recovered', conds: [{ label: 'F&G', now: fg, op: '>=', ref: 55, closed: true }] }
    ]);
    if (fg >= 55) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Entry is a pure sentiment trigger (no price level), so no price watch while flat
  if (fg <= 20) {
    // 60% of cash per panic buy; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
