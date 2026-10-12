/*
 * @coinsori-strategy v1
 * name: DxyAvailabilityTest
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — check whether ctx.data('dxy') returns values in the backtest feed.
 * When it buys and sells: Buys whenever DXY is non-null (first non-null bar), sells 5 bars later.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const st = ctx.state;
  if (!st.lastDxy) st.lastDxy = [];
  if (dxy != null) st.lastDxy.push(dxy);
  const pos = ctx.position || 0;
  if (pos > 0 && st.lastDxy.length >= 5) return { side: 'sell', qty: pos };
  if (pos === 0 && dxy != null) return { side: 'buy', qty: 0.01 };
  return null;
}
