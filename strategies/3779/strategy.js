/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index measures crowd sentiment on a
 *   0-100 scale. Crowds are systematically wrong at extremes: extreme fear marks
 *   washout bottoms (smart money buys the panic) and extreme greed marks local
 *   tops. This is a contrarian bet that sentiment extremes mean-revert.
 * When it buys and sells: buy when the fear & greed index drops to 25 or below
 *   (extreme fear). Sell when it rises to 70 or above (extreme greed), or on a
 *   15% hard stop below the entry price to cap any single-trade loss.
 * When it does NOT work: in a long sustained bear market fear can stay extreme
 *   for months and the 15% stop is hit repeatedly; and in a strong bull market
 *   greed can stay high for months so profits are left on the table while the
 *   index refuses to reach 70.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const stop = ctx.entryPx * 0.85;   // 15% hard stop: cap any single-trade loss
    if (ctx.price <= stop || (fg != null && fg > 70)) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% hard stop' },
               { side: 'sell', price: 70, trigger: 'above', note: 'fear-greed >= 70 (greed)' }]);
    return null;
  }

  if (fg == null) return null;
  if (fg > 25) return null;   // only buy when the crowd is extremely fearful (contrarian)
  const qty = (ctx.cash * 0.95) / ctx.price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
