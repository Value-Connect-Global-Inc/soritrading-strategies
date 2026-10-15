/*
 * @coinsori-strategy v1
 * name: Probe DXY shape v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — discover the exact return shape of
 * ctx.macro('dxy') and ctx.macroSeries so the real macro-regime strategy can
 * be written against the actual API. It makes one tiny buy so we know the
 * strategy is actually executing, and logs the shapes via ctx.warn.
 * When it buys and sells: buys 0.0001 BTC on the first bar, never sells.
 * When it does NOT work: not applicable — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  if (ctx.i === 1) {
    const m = ctx.macro('dxy');
    const s = ctx.macroSeries;
    ctx.warn('macro dxy = ' + JSON.stringify(m));
    ctx.warn('macroSeries = ' + JSON.stringify(s));
    ctx.warn('data dxy = ' + JSON.stringify(ctx.data('dxy')));
    return { side: 'buy', qty: 0.0001 };
  }
  return null;
}
