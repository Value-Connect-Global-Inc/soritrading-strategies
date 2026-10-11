/*
 * @coinsori-strategy v1
 * name: PROBE macro dxy truthy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buy a tiny amount only if ctx.macro('dxy') is truthy (not null/undefined),
 * to find the shape of the macro channel.
 */
function onUpdate(ctx) {
  const dxy = ctx.macro('dxy');
  if (dxy != null) {
    return { side: 'buy', qty: 0.001 };
  }
  return null;
}
