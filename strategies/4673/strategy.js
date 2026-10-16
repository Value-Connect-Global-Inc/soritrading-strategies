/*
 * @coinsori-strategy v1
 * name: DIAG DXY Availability
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Minimal test: if ctx.data('dxy') returns a non-null value, buy and hold.
 * If this trades, the dxy dataset joins the backtest; if it stays flat,
 * ctx.data('dxy') is null in this environment.
 */
function onUpdate(ctx) {
  const c = ctx.closes;
  if (c.length < 50) return null;
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;

  if (ctx.pos(ctx.sym) > 0) return null;
  const qty = (ctx.cash * 0.95 / ctx.price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
