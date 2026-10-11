/*
 * @coinsori-strategy v1
 * name: PROBE macro dxy shape
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buy a tiny amount only if ctx.macro('dxy') has a numeric .value field.
 */
function onUpdate(ctx) {
  const dxy = ctx.macro('dxy');
  if (dxy && typeof dxy === 'object' && typeof dxy.value === 'number' && isFinite(dxy.value)) {
    return { side: 'buy', qty: 0.001 };
  }
  return null;
}
