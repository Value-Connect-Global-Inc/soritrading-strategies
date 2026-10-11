/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index is a sentiment mean-reversion
 *   signal — extreme fear marks local bottoms, extreme greed marks tops.
 *   Betting on that reversal, but only inside a long-term uptrend (price
 *   above the 200-bar SMA) so we buy dips, not falling knives.
 * When it buys and sells: buy when Fear & Greed < 30 (extreme fear) and
 *   price is above its 200-bar SMA; sell when Fear & Greed >= 65 (greed) or
 *   on a 2x ATR hard stop, or if price closes back below the SMA.
 * When it does NOT work: a persistent bear market keeps price below the SMA
 *   so we never buy and stay flat; a crash that never recovers to greed can
 *   still hit the stop; if the index stops moving, no trades.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');   // 0-100 sentiment, user's own dataset
  const s = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || s == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (price < s) return { side: 'sell', qty: pos };
    if (fg >= 65) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: s, trigger: 'below', note: 'regime break' }]);
    return null;
  }

  if (price <= s) return null;   // only buy inside an uptrend (no falling knives)
  if (fg >= 30) return null;     // need extreme fear to enter

  const riskCash = ctx.cash * 0.01;        // 1% equity risked per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
