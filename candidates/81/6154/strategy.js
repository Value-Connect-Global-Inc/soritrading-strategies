/*
 * @coinsori-strategy v1
 * name: RS Momentum Rotation Top1 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT, DOGE/USDT
 * interval: 4h
 * cash: 10000
 *
 * Probe: does a multi-symbol run execute orders at all? Buys 0.001 on bar 0, no data access.
 */
function onUpdate(ctx) {
  ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'above', note: 'probe' }]);
  if (ctx.i === 0) {
    return { side: 'buy', qty: 0.001 };
  }
  return null;
}
