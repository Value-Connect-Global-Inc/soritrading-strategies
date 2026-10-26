/*
 * @coinsori-strategy v1
 * name: PROBE addr bar coverage 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: flips a tiny position every bar where addr data is non-null,
 * so the trade count reveals how many bars actually have on-chain data.
 */
function onUpdate(ctx) {
  const a = ctx.data('addr');
  if (a == null) return null;
  const pos = ctx.position || 0;
  // alternate buy/sell so each data bar = one trade
  const bar = ctx.i;
  if (bar % 2 === 0) {
    if (pos > 0) return null;
    return { side: 'buy', qty: 0.0001 };
  } else {
    if (pos <= 0) return null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
}
