/*
 * @coinsori-strategy v1
 * name: DXY Data Probe BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic probe — counts how many non-null ctx.data('dxy')
 * values arrive and whether ctx.state persists across bars. Buys only after 20
 * non-null DXY values are seen (proves accumulation works). If it still trades 0,
 * ctx.state does not persist in this engine or DXY rarely returns a value.
 * When it buys and sells: buys BTC once 20 non-null DXY values have accumulated.
 * When it does NOT work: this is a data-API diagnostic, not a trading idea.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.count = (s.count ?? 0);
    const d = ctx.data('dxy');
    if (d != null) s.count++;
    s.lastBarI = ctx.i;
    ctx.log('bar', ctx.i, 'dxy', d, 'count', s.count);
  }
  if (s.count == null || s.count < 20) return null;
  if (ctx.position === 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
