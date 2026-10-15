/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys once 5 non-null DXY values accumulate,
 * to measure how fast ctx.data('dxy') feeds values into the rolling buffer.
 * When it buys and sells: buys on the 5th accumulated value; holds forever.
 * When it does NOT work: this is a diagnostic, not a strategy.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.hist = s.hist ?? [];
    const d = ctx.data('dxy');
    if (d != null) s.hist.push(d);
    s.lastBarI = ctx.i;
  }
  if (s.hist == null || s.hist.length < 5) return null;
  if (ctx.position === 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
