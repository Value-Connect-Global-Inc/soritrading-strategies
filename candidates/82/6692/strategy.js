/*
 * @coinsori-strategy v1
 * name: BTC Regime Long Crash-Dodge 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends for months at a time; the worst losses come from staying long through bear markets. A slow 200-bar average separates uptrends from downtrends, so the position is held through rallies and closed before crashes.
 * When it buys and sells: It buys when the close is 2% above the 200-bar average (uptrend confirmed) and sells when the close is 2% below it (trend broken). A 3x ATR stop-loss protects every open position.
 * When it does NOT work: In a long sideways market the price crosses the 2% band back and forth and fees add up. In a sudden V-shaped crash the price can gap through the stop before the trend filter reacts.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;
  const pos = ctx.position || 0;
  const cash = ctx.cash || 0;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || atr == null || prevClose == null) return null;

  if (pos > 0) {
    // Exit on trend break (closed bar) or hard 3xATR stop (current price)
    const exitLvl = sma200 * 0.98; // 2% band below SMA200 = trend broken
    const hardStop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    const watch = [{ side: 'sell', price: exitLvl, trigger: 'below', note: 'trend break exit' }];
    if (hardStop != null) watch.push({ side: 'sell', price: hardStop, trigger: 'below', note: '3xATR stop' });
    ctx.watch(watch);
    if (prevClose < exitLvl) return { side: 'sell', qty: pos, reduceOnly: true };
    if (hardStop != null && price < hardStop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Flat: buy only when the uptrend is confirmed by a 2% margin above SMA200
  const entryLvl = sma200 * 1.02;
  ctx.watch([{ side: 'buy', price: entryLvl, trigger: 'above', note: 'uptrend entry' }]);
  if (prevClose > entryLvl) {
    const qty = (cash / price) * 0.98;
    return { side: 'buy', qty: qty };
  }
  return null;
}
