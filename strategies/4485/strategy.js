/*
 * @coinsori-strategy v1
 * name: dxy-data-probe (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buys whenever the dxy dataset returns a non-null value, to verify the
 * dataset actually reaches the backtest agent. Not a real strategy.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) return { side: 'sell', qty: pos };
  if (dxy == null) return null;
  const qty = (ctx.cash / ctx.price) * 0.99;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
