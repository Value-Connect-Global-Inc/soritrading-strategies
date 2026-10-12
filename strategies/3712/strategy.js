/*
 * @coinsori-strategy v1
 * name: DxyRiskOnCount
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic — count how often DXY sits below its 200-day average (risk-on) and
 * confirm the 210-value warmup is reached in the backtest window.
 * When it buys and sells: Buys a tiny amount on each risk-on flip; sells the next bar.
 * When it does NOT work: N/A — diagnostic only.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const st = ctx.state;
  if (!st.dxyHist) st.dxyHist = [];
  if (!st.flips) st.flips = 0;
  if (dxy != null) st.dxyHist.push(dxy);
  const pos = ctx.position || 0;
  if (pos > 0) return { side: 'sell', qty: pos };

  if (st.dxyHist.length < 210) return null;
  const n = st.dxyHist.length;
  let sum = 0;
  for (let i = n - 200; i < n; i++) sum += st.dxyHist[i];
  const sma = sum / 200;
  const riskOn = dxy < sma;
  if (riskOn && !st.lastRiskOn) {
    st.flips += 1;
    return { side: 'buy', qty: 0.01 };
  }
  st.lastRiskOn = riskOn;
  return null;
}
