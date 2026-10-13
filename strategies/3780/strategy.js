/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D v2 (trend-filtered)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index measures crowd sentiment on a
 *   0-100 scale. Crowds are wrong at extremes, BUT buying extreme fear without a
 *   trend filter was a disaster (2018-22 -94%): in a bear market fear stays low
 *   and price keeps falling, hitting the stop repeatedly. v2 only buys extreme
 *   fear when price is above the 200-day average — i.e. a pullback within an
 *   uptrend, not a falling knife. It sells on extreme greed or a 15% stop.
 * When it buys and sells: buy when fear & greed <= 25 AND price is above the
 *   200-day SMA. Sell when fear & greed >= 70 or on a 15% hard stop.
 * When it does NOT work: misses the washout bottom of a real crash because price
 *   is below the 200-day SMA at that moment, and it still loses on sustained
 *   bear markets where price sits below the SMA for months (no trades = safe).
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null || sma200 == null) return null;

  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const stop = ctx.entryPx * 0.85;   // 15% hard stop: cap any single-trade loss
    if (ctx.price <= stop || (fg != null && fg > 70)) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% hard stop' },
               { side: 'sell', price: 70, trigger: 'above', note: 'fear-greed >= 70 (greed)' }]);
    return null;
  }

  if (fg == null) return null;
  if (fg > 25) return null;           // only buy when the crowd is extremely fearful (contrarian)
  if (prevClose < sma200) return null; // uptrend filter: do NOT catch falling knives in a bear market
  const qty = (ctx.cash * 0.95) / ctx.price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
