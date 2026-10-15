/*
 * @coinsori-strategy v1
 * name: Probe dxy dataset only
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe — checks whether ctx.data('dxy') delivers a value
 * in backtest. Buys 0.0001 BTC on the first bar if dxy is a finite number.
 * When it buys and sells: probe only.
 * When it does NOT work: not applicable.
 */
function onUpdate(ctx) {
  const d = ctx.data('dxy');
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (ctx.i === 1) {
    if (typeof d === 'number' && Number.isFinite(d)) {
      return { side: 'buy', qty: 0.0001 };
    }
    return null;
  }
  if (ctx.i === 2 && ctx.position > 0) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
