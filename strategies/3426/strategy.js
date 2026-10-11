/*
 * @coinsori-strategy v1
 * name: BTC Plain BB MR 1D control
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: control for the on-chain regime filter — plain Bollinger mean reversion.
 * When it buys and sells: buys when price touches the lower Bollinger Band; sells when price
 * returns to the middle band or hits a 2xATR stop.
 * When it does NOT work: buying every dip in a falling market means catching falling knives.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || atr == null) return null;

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'below', note: 'MR target' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }
    ]);
    if (ctx.price >= bb.mid) return { side: 'sell', qty: ctx.position };
    if (ctx.entryPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position };
    return null;
  }

  if (ctx.price <= bb.lower) return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower' }]);
  return null;
}
