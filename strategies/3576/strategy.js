/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index is a sentiment mean-reversion
 *   signal — extreme fear marks panic bottoms worth buying, extreme greed
 *   marks tops worth selling. We only take that bet inside an established
 *   uptrend (price above the 66-day SMA) so we buy dips, not falling knives.
 * When it buys and sells: buy when Fear & Greed < 20 (extreme fear) and
 *   price is above its 400-bar SMA; sell when Fear & Greed >= 70 (extreme
 *   greed) or on a wide 15% hard stop from entry.
 * When it does NOT work: a long bear market keeps price below the SMA so we
 *   stay flat; a panic that never recovers to greed can still hit the stop;
 *   if sentiment stops moving, no trades.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');   // 0-100 sentiment, user's own dataset
  const s = ctx.sma(400, 1);           // 66-day uptrend filter on 4h bars
  if (fg == null || s == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    if (fg >= 70) return { side: 'sell', qty: pos };      // extreme greed = take profit
    const stopPx = ctx.entryPx * 0.85;                    // wide 15% stop: contrarian entries are volatile
    if (price <= stopPx) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '15% stop' }]);
    return null;
  }

  if (price <= s) return null;   // only buy inside an established uptrend
  if (fg >= 20) return null;     // canonical extreme-fear threshold (0-25 band)

  ctx.log('fg', fg, 'sma', s, 'price', price);
  const riskCash = ctx.cash * 0.01;        // 1% equity risked per trade
  const stopDist = 0.15 * price;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
