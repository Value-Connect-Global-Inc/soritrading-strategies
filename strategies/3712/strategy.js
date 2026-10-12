/*
 * @coinsori-strategy v1
 * name: DxyLevelProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — check if ctx.data('dxy') varies by trading on a fixed level (like
 * the earlier working experiment) versus a relative condition.
 * When it buys and sells: Buys when dxy < 100 (absolute), sells when dxy >= 100.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;
  const pos = ctx.position || 0;
  if (pos > 0 && dxy >= 100) return { side: 'sell', qty: pos };
  if (pos === 0 && dxy < 100) return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  return null;
}
