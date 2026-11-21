/*
 * @coinsori-strategy v1
 * name: BTC 200-Day Regime Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends for months at a time. The 200-day average is a
 * slow, reliable gauge of whether the market is in an uptrend (price above it)
 * or a downtrend (price below it). This strategy stays invested through strong
 * uptrends and steps aside in downtrends, so it captures most of a bull run
 * while avoiding the worst of a bear market.
 * When it buys and sells: buys when the daily close is above the 200-day SMA;
 * sells when the daily close falls below the 200-day SMA. A small 3% buffer
 * band around the line stops the strategy from flipping on tiny daily wiggles.
 * When it does NOT work: it is long-only, so it earns nothing in a falling
 * market and gives back part of a sharp crash before the slow 200-day line
 * catches up with the exit.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);   // slow regime line
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;

  // 3% buffer around the 200d line so a single-day wiggle does not flip the position.
  const buyLevel = sma200 * 1.03;
  const sellLevel = sma200 * 0.97;

  const watchList = [];
  if (pos > 0) {
    watchList.push({ side: 'sell', price: sellLevel, trigger: 'below', note: 'Regime down (below 200d SMA)' });
  } else {
    watchList.push({ side: 'buy', price: buyLevel, trigger: 'above', note: 'Regime up (above 200d SMA)' });
  }
  ctx.watch(watchList);

  if (pos > 0) {
    if (prevClose < sellLevel) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos === 0 && prevClose > buyLevel) {
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty };
  }
  return null;
}
