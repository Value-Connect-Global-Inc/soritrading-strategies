/*
 * @coinsori-strategy v1
 * name: DxyWarmup210
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — test whether ctx.data('dxy') history reaches 210 in this window.
 * When it buys and sells: Buys when DXY history length hits 210, sells next bar.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const st = ctx.state;
  if (!st.dxyHist) st.dxyHist = [];
  if (dxy != null) st.dxyHist.push(dxy);
  const pos = ctx.position || 0;
  if (pos > 0) return { side: 'sell', qty: pos };
  if (st.dxyHist.length === 210) return { side: 'buy', qty: 0.01 };
  return null;
}
