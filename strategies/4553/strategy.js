/*
 * @coinsori-strategy v1
 * name: Multi-Sym Alive Probe (BTC/ETH 1D)
 * interval: 1d
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * cash: 10000
 *
 * Why this strategy: Confirm the strategy actually executes per-symbol in
 * multi-sym backtest mode. Buys a tiny amount on bar 100 to prove it runs.
 * When it buys and sells: buys once on bar 100, sells never.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  if (ctx.i < 100) return null;
  if (ctx.position > 0) return null;
  const qty = (ctx.cash * 0.01) / ctx.price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
