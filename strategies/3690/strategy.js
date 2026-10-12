/*
 * @coinsori-strategy v1
 * name: DataDiag
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic only — determines whether external dataset
 * values are numbers or numeric strings by trading on each interpretation.
 * When it buys and sells: buys 0.0001 BTC only when the value passes a
 * specific type test; the trade count tells us which interpretation is real.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || fg == null) return null;
  // Test A: fg is a number in range 0..100 (true number).
  const isNum = typeof fg === 'number' && fg >= 0 && fg <= 100;
  // Test B: fg is an object with a numeric .v field (raw row).
  const isObj = typeof fg === 'object' && fg != null && Number.isFinite(fg.v);
  // Test C: fg is a numeric string.
  const isStr = typeof fg === 'string' && Number.isFinite(Number(fg));
  if (isNum || isObj || isStr) {
    return { side: 'buy', qty: 0.0001 };
  }
  if (ctx.position > 0) return { side: 'sell', qty: ctx.position };
  return null;
}
