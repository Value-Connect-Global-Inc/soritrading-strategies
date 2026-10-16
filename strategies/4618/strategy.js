/*
 * @coinsori-strategy v1
 * name: Fear Greed Dip Buy 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sentiment extremes are contrarian. When the crowd is
 * gripped by extreme fear (Fear & Greed index below 25) but the longer trend
 * is still up, that is a buying opportunity — fear marks a dip, not a regime
 * change. When the crowd turns to extreme greed (index above 70) the easy
 * money has been made and we take profit. This uses the sentiment axis,
 * different from the price-momentum champion.
 * When it buys and sells: buy when the Fear & Greed index is below 25 AND
 * price is above its 200-day average. Sell when the index is above 70 or price
 * falls below its 200-day average.
 * When it does NOT work: in a genuine bear market the 200-day gate keeps us
 * out (good) but we also miss the entire decline being flat — the strategy is
 * long-only. If fear prints stay below 25 for months while price grinds lower
 * inside a bull, the 200-day gate eventually flips and we exit late. It needs
 * volatile sentiment swings to trade; a calm steadily-rising market gives few
 * entries.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  if (fg == null || sma200 == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    // Take profit at extreme greed, or exit if the uptrend breaks.
    if (fg > 70 || price <= sma200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend gate' }]);
    return null;
  }

  // Buy extreme fear only inside an intact uptrend — avoids catching the
  // falling knife in a bear market, keeps this a dip-buy not a bottom-fish.
  if (fg < 25 && price > sma200) {
    const qty = (ctx.cash * 0.99) / price;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }
  return null;
}
