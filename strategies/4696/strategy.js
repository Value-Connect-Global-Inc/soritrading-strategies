/*
 * @coinsori-strategy v1
 * name: data key probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: DEBUG probe — check which ctx.data keys return values. Buys 0.001 BTC on the first bar where ANY of addr/dxy/fear_greed is non-null.
 * When it buys and sells: buys once when a data key is available, never sells.
 * When it does NOT work: n/a (debug only).
 */
function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const dxy = ctx.data('dxy');
  const fg = ctx.data('fear_greed');
  ctx.logOnce('probe', 'addr=' + addr + ' dxy=' + dxy + ' fg=' + fg + ' i=' + ctx.i);
  if (addr != null || dxy != null || fg != null) {
    return { side: 'buy', qty: 0.001 };
  }
  return null;
}
