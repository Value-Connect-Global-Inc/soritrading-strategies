/*
 * @coinsori-strategy v1
 * name: DataDiag
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic only — identifies the exact type/shape of
 * external dataset values. Each interpretation buys a DIFFERENT quantity so
 * the trade count (qty-based) reveals which shape is real.
 * When it buys and sells: buys 0.0001 (string), 0.0002 (object .v), or
 * 0.0003 (number) depending on which type test fg passes.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || fg == null) return null;
  const isNum = typeof fg === 'number';
  const isObj = typeof fg === 'object' && fg != null && Number.isFinite(fg.v);
  const isStr = typeof fg === 'string' && Number.isFinite(Number(fg));
  if (isNum) return { side: 'buy', qty: 0.0003 };
  if (isObj) return { side: 'buy', qty: 0.0002 };
  if (isStr) return { side: 'buy', qty: 0.0001 };
  if (ctx.position > 0) return { side: 'sell', qty: ctx.position };
  return null;
}
