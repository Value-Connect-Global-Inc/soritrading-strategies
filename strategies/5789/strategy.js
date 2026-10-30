/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Sentiment contrarian on the Crypto Fear & Greed Index. Crowds panic at
 * the bottom and euphoria at the top; buying when the index is in extreme fear and selling
 * when it returns to greed has historically caught the biggest reversals. The rising
 * 200-day average gate keeps it out of a genuine crash where fear persists.
 * When it buys and sells: Buys when the Fear & Greed Index is below 20 (extreme fear) while
 * price stays above a rising 200-day average. Sells when the index climbs above 55 (greed)
 * or on a hard 2.5-ATR stop from entry.
 * When it does NOT work: In a prolonged bear market the index sits in fear for months while
 * price grinds lower — the rising-average gate should keep it flat, but a V-shaped crash
 * can trigger before the average turns down.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (atr == null || atr <= 0 || sma200 == null || sma200prev == null) return null;

  const pos = ctx.pos(ctx.sym);
  const entry = ctx.entryPx;
  if (pos > 0) {
    const stop = entry != null && entry > 0 ? entry - 2.5 * atr : null;
    const watchList = [];
    if (fg != null) watchList.push({ side: 'sell', price: 55, trigger: 'above', note: 'F&G back to greed' });
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard 2.5 ATR stop' });
    ctx.watch(watchList);
    if (fg != null && fg > 55) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (fg != null && fg < 20 && sma200 > sma200prev && price > sma200) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
