/*
 * @coinsori-strategy v1
 * name: State Persistence Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: increments a state counter and buys once it reaches 30, to test
 * whether ctx.state persists across bars in the backtest.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const n = (ctx.state.n || 0) + 1;
  ctx.state.n = n;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    return null;
  }
  if (n < 30) return null;
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
