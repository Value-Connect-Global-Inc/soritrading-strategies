/*
 * @coinsori-strategy v1
 * name: StatePersistenceProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic only — tests two engine features in one run:
 * (1) does ctx.state persist across bars, (2) does ctx.data('dxy') return a value.
 * It buys once at bar 100 if state persisted, and logs the dxy value.
 * When it buys and sells: Buys at bar 100, sells at bar 130. Never meant for real trading.
 * When it does NOT work: Not a real strategy. Throwaway probe.
 */

function onUpdate(ctx) {
  const c = (ctx.state.c || 0) + 1;
  ctx.state.c = c;

  const dxy = ctx.data('dxy');
  if (c === 100) ctx.log('PROBE counter=100 dxy=' + dxy);

  if (c === 100) {
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (c === 130) {
    return { side:'sell', qty: ctx.position };
  }
  return null;
}
