/*
 * @coinsori-strategy v1
 * name: dxy-gate-probe (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Probe: buys whenever dxy < its own rolling 60-day average (the exact gate used
 * in the dollar-regime strategy), no price conditions. Tests whether the gate
 * logic ever fires. Not a real strategy.
 */
function onUpdate(ctx) {
  const pos = ctx.pos(ctx.sym);
  if (pos > 0) return { side: 'sell', qty: pos };
  const dxy = ctx.data('dxy');
  const hist = ctx.state.dxyHist || [];
  let pass = false;
  if (dxy != null) {
    if (hist.length >= 60) {
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      pass = dxy < avg;
    }
    hist.push(dxy);
    if (hist.length > 60) hist.shift();
    ctx.state.dxyHist = hist;
  }
  if (!pass) return null;
  const qty = (ctx.cash / ctx.price) * 0.99;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
