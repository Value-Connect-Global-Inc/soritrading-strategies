/*
 * @coinsori-strategy v1
 * name: DXY Null Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buys whenever dxy is not null and price above 50-EMA. Tests whether
 * ctx.data('dxy') returns values at all.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const dxy = ctx.data('dxy');
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (dxy == null || ema50 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < ema50) return { side: 'sell', qty: pos };
    return null;
  }
  if (prevClose <= ema50) return null;
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
