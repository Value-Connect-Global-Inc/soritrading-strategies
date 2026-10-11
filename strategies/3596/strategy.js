/*
 * @coinsori-strategy v1
 * name: state persistence test
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic only — verifies that ctx.state persists across bars.
 * When it buys and sells: buys once on bar 60 if state is persistent, else never.
 * When it does NOT work: not a real strategy, diagnostic only.
 */
function onUpdate(ctx) {
  const c = (ctx.state && ctx.state.count) || 0;
  ctx.state.count = c + 1;
  if (c + 1 === 60) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.5 };
  }
  if (ctx.position > 0) return { side: 'sell', qty: ctx.position };
  return null;
}
