/*
 * @coinsori-strategy v1
 * name: DxyProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic only — tests whether ctx.data('dxy') returns a
 * usable value in the backtest engine. Buys at bar 100 ONLY if dxy is not null.
 * When it buys and sells: Buys at bar 100 if dxy present, sells at bar 130.
 * When it does NOT work: Not a real strategy. Throwaway probe.
 */

function onUpdate(ctx) {
  const c = (ctx.state.c || 0) + 1;
  ctx.state.c = c;
  const dxy = ctx.data('dxy');
  if (c === 100) {
    if (dxy == null) return null; // dxy missing -> no trade
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (c === 130) return { side:'sell', qty: ctx.position };
  return null;
}
