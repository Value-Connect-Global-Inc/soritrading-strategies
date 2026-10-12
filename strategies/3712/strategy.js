/*
 * @coinsori-strategy v1
 * name: DxyValueDump
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — dump ctx.data('dxy') values and a short average to see what is returned.
 * When it buys and sells: Buys a tiny amount when dxy < 5-period average; sells next bar.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const st = ctx.state;
  if (!st.dxyHist) st.dxyHist = [];
  if (dxy != null) st.dxyHist.push(dxy);
  if (st.dxyHist.length >= 10 && st.dxyHist.length % 100 === 0) {
    const last = st.dxyHist.slice(-5);
    const avg = last.reduce((a, b) => a + b, 0) / last.length;
    ctx.warn('len=' + st.dxyHist.length + ' last5=' + last.join(',') + ' avg=' + avg);
  }
  const pos = ctx.position || 0;
  if (pos > 0) return { side: 'sell', qty: pos };
  if (st.dxyHist.length < 10) return null;
  const last = st.dxyHist.slice(-5);
  const avg = last.reduce((a, b) => a + b, 0) / last.length;
  if (dxy != null && dxy < avg) return { side: 'buy', qty: 0.01 };
  return null;
}
