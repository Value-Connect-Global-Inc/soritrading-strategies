/*
 * @coinsori-strategy v1
 * name: DXY Data Check
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: diagnostic only — checks whether ctx.data('dxy') is loaded
 * by the backtest runner. Buys whenever dxy is non-null.
 * When it buys and sells: buys when ctx.data('dxy') returns non-null, sells on
 * the 2-ATR stop. Not a real strategy.
 * When it does NOT work: irrelevant — this is a diagnostic.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;
  const pos = ctx.position;
  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    if (atr == null) return null;
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2 * atr : price - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    return null;
  }
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
