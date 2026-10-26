/*
 * @coinsori-strategy v1
 * name: PROBE addr vs addr_sma30 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: logs which on-chain key is non-null on each bar and buys a
 * distinguishing quantity so the final position reveals which key works.
 */
function onUpdate(ctx) {
  const a = ctx.data('addr');
  const b = ctx.data('addr_sma30');
  if (a != null) ctx.log('ADDR_OK v=' + a);
  if (b != null) ctx.log('SMA30_OK v=' + b);
  if (a == null && b == null) return null;
  const pos = ctx.position || 0;
  if (pos > 0) return null;
  // buy 0.001 if raw addr works, 0.002 if sma30 works (distinguishing)
  const qty = a != null ? 0.001 : 0.002;
  return { side: 'buy', qty: qty };
}
