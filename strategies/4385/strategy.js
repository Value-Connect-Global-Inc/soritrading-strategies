/*
 * @coinsori-strategy v1
 * name: Array State Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: pushes dxy into a state array and buys once it reaches 60 elements.
 * Tests whether arrays persist in ctx.state.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const dxy = ctx.data('dxy');
  const atr = ctx.atr(14, 1);
  if (dxy == null || atr == null || atr <= 0) return null;
  const hist = ctx.state.arr || [];
  hist.push(dxy);
  if (hist.length > 60) hist.shift();
  ctx.state.arr = hist;
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    return null;
  }
  if (hist.length < 60) return null;
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
