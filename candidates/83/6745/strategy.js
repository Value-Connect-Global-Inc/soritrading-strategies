/*
 * @coinsori-strategy v1
 * name: PROBE funding-on-spot SOL 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Diagnostic probe: does ctx.funding return a value on a SPOT market?
 * If funding is available on spot, this strategy makes one round trip;
 * if ctx.funding is null on spot, it never trades (0 trades = funding absent).
 */
function onUpdate(ctx) {
  const f = ctx.funding;
  if (f == null) { ctx.watch([]); return null; }
  if (!ctx.state.did) {
    ctx.state.did = true;
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'below', note: 'probe buy' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.5 };
  }
  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'above', note: 'probe exit' }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  ctx.watch([]);
  return null;
}
