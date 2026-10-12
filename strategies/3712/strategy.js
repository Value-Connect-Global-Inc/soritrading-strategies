/*
 * @coinsori-strategy v1
 * name: DollarRegimeBTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto behaves like a risk asset — it historically rallies while the US dollar
 * weakens and struggles while the dollar strengthens. The dollar index (DXY) regime is a slow,
 * reliable risk switch, so we ride BTC only during dollar downtrends.
 * When it buys and sells: Holds BTC while the dollar index is below its 200-day average (risk-on).
 * Sells to cash when the dollar index rises back above its 200-day average (risk-off). No per-trade
 * stop: the whole regime is the exit.
 * When it does NOT work: When crypto decouples from the dollar (crypto-specific shocks, regulation,
 * or a BTC bull that happens even while the dollar is strong) the signal is wrong and it can sit in
 * cash during a rally. DXY updates on weekdays only, so the regime reacts slowly to weekend moves.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) return null;
  const dxy = ctx.data('dxy');
  if (dxy == null) return null; // macro data missing — do nothing rather than guess

  // Build DXY history ourselves: the dataset returns the current value only, so accumulate it.
  const st = ctx.state;
  if (!st.dxyHist) st.dxyHist = [];
  st.dxyHist.push(dxy);
  if (st.dxyHist.length > 260) st.dxyHist.shift();
  if (st.dxyHist.length < 210) return null; // need 200 points for the DXY average + warmup

  const n = st.dxyHist.length;
  let sum = 0;
  for (let i = n - 200; i < n; i++) sum += st.dxyHist[i];
  const dxySma200 = sum / 200;
  const riskOn = dxy < dxySma200; // dollar weaker than its long-term average = risk-on

  const pos = ctx.position || 0;
  if (pos > 0 && !riskOn) return { side: 'sell', qty: pos };
  if (pos === 0 && riskOn) return { side: 'buy', qty: (ctx.cash / px) * 0.99 };

  ctx.watch([{
    side: 'buy', note: 'DXY regime flip to risk-on',
    conds: [{ label: 'DXY vs 200d avg', now: dxy, op: '<', ref: dxySma200, closed: true }]
  }]);
  return null;
}
