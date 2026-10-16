/*
 * @coinsori-strategy v1
 * name: DIAG State Persistence
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Test: does ctx.state persist across bars? Count in state, buy after 5 bars.
 */
function onUpdate(ctx) {
  const c = ctx.closes;
  if (c.length < 10) return null;
  if (ctx.state.n == null) ctx.state.n = 0;
  ctx.state.n = ctx.state.n + 1;
  if (ctx.state.n < 5) return null;
  if (ctx.pos(ctx.sym) > 0) return null;
  const qty = (ctx.cash * 0.95 / ctx.price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
