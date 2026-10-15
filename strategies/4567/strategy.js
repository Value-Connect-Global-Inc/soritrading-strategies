/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys when ctx.data('dxy') < 110. Real DXY in
 * 2023 was ~99-107, so if ctx.data returns real per-bar values this buys on the
 * first bar. If ctx.data('dxy') is null on most bars, it stays flat.
 * When it buys and sells: buys on the first bar with dxy < 110; holds forever.
 * When it does NOT work: this is a diagnostic, not a strategy.
 */
function onUpdate(ctx) {
  const d = ctx.data('dxy');
  if (d == null || d >= 110) return null;
  if (ctx.position === 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
