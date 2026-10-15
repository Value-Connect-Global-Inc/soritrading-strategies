/*
 * @coinsori-strategy v1
 * name: Probe DXY data probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe — trades on the raw DXY value so the backtest
 * result shows whether ctx.data('dxy') / ctx.macro('dxy') actually deliver
 * data. Buys when DXY < 100 (a value that was true in some periods), sells
 * when DXY > 100.
 * When it buys and sells: probe only.
 * When it does NOT work: not applicable.
 */
function onUpdate(ctx) {
  const d = ctx.data('dxy');
  const m = ctx.macro('dxy');
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  if (ctx.i === 1) {
    ctx.watch([{ side: 'buy', note: 'data dxy=' + String(d) + ' macro=' + String(m) }]);
    if (d != null && d < 100) return { side: 'buy', qty: 0.0001 };
    return null;
  }
  if (ctx.i === 2 && ctx.position > 0) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
