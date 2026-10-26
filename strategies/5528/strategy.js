/*
 * @coinsori-strategy v1
 * name: PROBE addr data flow 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic only: buys a small fixed amount whenever the on-chain address
 * dataset returns a non-null value. Purpose is to check whether ctx.data
 * ('addr_sma30') actually flows into the backtest engine.
 */
function onUpdate(ctx) {
  const a = ctx.data('addr_sma30');
  const b = ctx.data('addr');
  if (a == null && b == null) return null;
  const pos = ctx.position || 0;
  if (pos > 0) return null;
  // tiny fixed position, just to prove data flows
  return { side: 'buy', qty: 0.001 };
}
