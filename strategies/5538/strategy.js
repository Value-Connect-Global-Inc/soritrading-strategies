/*
 * @coinsori-strategy v1
 * name: PROBE addr level 500k 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: buys a tiny fixed amount whenever addr > 500000. The number
 * of trades reveals how much of the window the address count is above 500k,
 * exposing the data's actual magnitude and trend.
 */
function onUpdate(ctx) {
  const a = ctx.data('addr');
  if (a == null) return null;
  const pos = ctx.position || 0;
  if (a > 500000) {
    if (pos > 0) return null;
    return { side: 'buy', qty: 0.0001 };
  } else {
    if (pos <= 0) return null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
}
