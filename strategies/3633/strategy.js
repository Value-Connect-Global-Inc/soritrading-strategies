/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd emotion. History
 *   shows extreme fear marks local bottoms more often than not, and extreme
 *   greed marks tops. We bet the crowd is wrong at the extremes.
 * When it buys and sells: buy when the index drops below 35 (fear), sell
 *   when it rises above 70 (greed) or on a 25% hard stop.
 * When it does NOT work: in a real bear market fear stays high and the price
 *   keeps falling, so each "cheap" buy is a knife; the 25% stop limits the
 *   damage but the strategy can bleed slowly. Also sits in cash for long
 *   stretches, missing steady uptrends.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');               // fear & greed index 0-100
  if (fg == null) return null;             // data unknown — do nothing (never treat null as 0)

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // Hard stop: 25% below entry. Generous because extreme-fear entries can dip further.
    const hardStop = ctx.entryPx * 0.75;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    // Sell into greed, or if fear returns we already sold. Take profit on index > 70.
    if (fg > 70) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '25% hard stop' },
               { side: 'sell', price: null, note: 'wait for F&G > 70' }]);
    return null;
  }

  if (fg >= 35) return null;   // contrarian entry: buy fear, not calm or greed
  // Only buy if price is above its 200-day average — avoid catching a falling
  // knife in a confirmed long-term downtrend.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || prevClose < sma200) return null;

  // Size: 40% of cash per position, so multiple fear episodes are survivable.
  const qty = (ctx.cash * 0.40) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
