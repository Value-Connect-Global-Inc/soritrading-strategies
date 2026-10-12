/*
 * @coinsori-strategy v1
 * name: DxyLenOnly
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — buy whenever DXY history length >= 210, ignoring the SMA condition,
 * to confirm accumulation reaches 210 in this window.
 * When it buys and sells: Buys a tiny amount once length hits 210; sells next bar.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;
  const st = ctx.state;
  if (!st.dxyHist) st.dxyHist = [];
  st.dxyHist.push(dxy);
  if (st.dxyHist.length > 260) st.dxyHist.shift();
  const pos = ctx.position || 0;
  if (pos > 0) return { side: 'sell', qty: pos };
  if (st.dxyHist.length >= 210) return { side: 'buy', qty: 0.01 };
  return null;
}
