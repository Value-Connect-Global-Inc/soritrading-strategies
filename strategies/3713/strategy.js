/*
 * @coinsori-strategy v1
 * name: FedProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — check if ctx.data('fed') is populated in the backtest feed.
 * When it buys and sells: Buys a tiny amount when fed is non-null; sells next bar.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const v = ctx.data('fed');
  const pos = ctx.position || 0;
  if (pos > 0) return { side: 'sell', qty: pos };
  if (v != null) return { side: 'buy', qty: 0.001 };
  return null;
}
