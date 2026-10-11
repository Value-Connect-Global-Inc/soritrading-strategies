/*
 * @coinsori-strategy v1
 * name: PROBE DXY data availability
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buy a tiny amount only if ctx.data('dxy') is a finite number, to test
 * whether the dxy dataset is readable in this backtest engine.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  if (typeof dxy === 'number' && isFinite(dxy)) {
    return { side: 'buy', qty: 0.001 };
  }
  return null;
}
