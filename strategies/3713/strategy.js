/*
 * @coinsori-strategy v1
 * name: DxyAloneProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — confirm ctx.data('dxy') works on this fresh strategy id.
 * When it buys and sells: Buys a tiny amount when dxy is non-null; sells next bar.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const v = ctx.data('dxy');
  const pos = ctx.position || 0;
  if (pos > 0) return { side: 'sell', qty: pos };
  if (v != null) return { side: 'buy', qty: 0.001 };
  return null;
}
