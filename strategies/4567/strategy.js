/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys only when the DXY value CHANGES from the
 * previous bar. If ctx.data('dxy') returns a constant (latest value cached for
 * every bar), this never trades and confirms the data is not per-bar aligned.
 * When it buys and sells: buys on the first bar where DXY differs from the
 * previous bar's DXY; holds forever after.
 * When it does NOT work: this is a diagnostic, not a strategy.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    const d = ctx.data('dxy');
    s.prev = s.cur ?? null;
    s.cur = d;
    s.lastBarI = ctx.i;
    if (s.prev != null && s.cur != null && d !== s.prev) {
      ctx.log('CHANGED bar', ctx.i, 'prev', s.prev, 'cur', s.cur);
    }
  }
  if (ctx.position === 0 && s.prev != null && s.cur != null && s.cur !== s.prev) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
