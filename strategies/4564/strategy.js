/*
 * @coinsori-strategy v1
 * name: Probe DXY shape
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — logs the shape of ctx.macro('dxy') and
 * ctx.data('dxy') so the real strategy can be written against the actual API.
 * When it buys and sells: never trades.
 * When it does NOT work: not applicable.
 */
function onUpdate(ctx) {
  const m = ctx.macro('dxy');
  const d = ctx.data('dxy');
  ctx.warn('macro dxy = ' + JSON.stringify(m) + ' | data dxy = ' + JSON.stringify(d));
  return null;
}
