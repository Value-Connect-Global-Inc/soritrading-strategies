/*
 * @coinsori-strategy v1
 * name: Market-Object Probe (BTC/ETH 1D)
 * interval: 1d
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * cash: 10000
 *
 * Why this strategy: Discover what ctx.market(sym) returns in multi-sym mode
 * by trading on it. If it has a usable price, we buy; the trade count tells us.
 * When it buys and sells: buy once per symbol if ctx.market(own sym) has a price.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  if (ctx.i < 100) return null;
  if (ctx.position > 0) return null;
  const m = ctx.market(ctx.sym);
  const px = m && typeof m.price === 'number' ? m.price : null;
  if (px == null || px <= 0) return null;
  const qty = (ctx.cash * 0.01) / px;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
