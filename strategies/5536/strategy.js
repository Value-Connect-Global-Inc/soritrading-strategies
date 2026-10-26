/*
 * @coinsori-strategy v1
 * name: PROBE addr_sma30 coverage 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: flips a tiny position every bar where addr_sma30 is non-null.
 * Trade count reveals how many bars carry the pre-computed 30d average.
 */
function onUpdate(ctx) {
  const a = ctx.data('addr_sma30');
  if (a == null) return null;
  const pos = ctx.position || 0;
  const bar = ctx.i;
  if (bar % 2 === 0) {
    if (pos > 0) return null;
    return { side: 'buy', qty: 0.0001 };
  } else {
    if (pos <= 0) return null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
}
