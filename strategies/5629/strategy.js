/*
 * @coinsori-strategy v1
 * name: DIAG Data Keys Probe 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic strategy: buys if base_ust10y data is available, proving ctx.data
 * works in backtest. Does not trade otherwise.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  if (pos > 0) return { side: 'sell', qty: pos, reduceOnly: true };
  const v = ctx.data('base_ust10y');
  if (v == null) return null;
  if (ctx.alloc.status !== 'ok') return null;
  return { side: 'buy', qty: ctx.cash / ctx.price * 0.5 };
}
