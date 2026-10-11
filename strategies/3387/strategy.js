/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The crypto Fear & Greed index is a survey of market mood. Extreme fear
 * usually marks capitulation — a good risk/reward point to buy. Extreme greed marks euphoria —
 * a good point to take profit. This strategy bets against the crowd at the extremes.
 * When it buys and sells: Buys BTC when the index is below 20 (extreme fear). Sells when the
 * index is above 70 (extreme greed) or when price falls 25% below entry (hard stop so a long
 * bear market cannot drain the account).
 * When it does NOT work: In a slow grinding bear where fear stays low for months, each buy can
 * still lose up to the 25% stop before the next exit. In a bull market that never gets greedy
 * enough to trigger the sell, it exits too early and misses the top.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed'); // 0-100 daily sentiment index
  if (fg == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry * 0.75; // hard stop 25% below entry — caps the bear-market knife catch
    const takeProfit = fg > 70; // extreme greed = euphoria = sell
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: '25% hard stop' },
      { side: 'sell', price: entry * 1.25, trigger: 'above', note: 'take profit' }
    ]);
    if (price < stop || takeProfit) return { side: 'sell', qty: pos };
    return null;
  }

  ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'needs extreme fear', conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 20, closed: true }] }]);
  if (fg < 20) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
