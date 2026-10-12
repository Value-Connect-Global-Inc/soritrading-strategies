/*
 * @coinsori-strategy v1
 * name: DxyAboveCount
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — count bars where dxy is ABOVE its accumulated 200-day average.
 * When it buys and sells: Buys a tiny amount on EVERY bar where dxy > 200d average; sells next bar.
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
  if (st.dxyHist.length < 210) return null;
  const n = st.dxyHist.length;
  let sum = 0;
  for (let i = n - 200; i < n; i++) sum += st.dxyHist[i];
  const sma = sum / 200;
  if (dxy > sma) return { side: 'buy', qty: 0.01 };
  return null;
}
