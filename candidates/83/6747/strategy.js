/*
 * @coinsori-strategy v1
 * name: PROBE funding pct SOL 4H
 * ex: binanceusdm
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Diagnostic: does the funding-percentile logic ever fire?
 * Buys (exits next bar) whenever funding percentile < 0.20 over last 60 bars.
 * Many round trips = percentile logic works; few = percentile never low.
 */
function onUpdate(ctx) {
  const fRaw = ctx.funding;
  if (fRaw != null) ctx.state.lastFunding = fRaw;
  const f = ctx.state.lastFunding;
  if (f == null) { ctx.watch([]); return null; }
  const hist = ctx.state.fundingHist || [];
  hist.push(f);
  if (hist.length > 80) hist.shift();
  ctx.state.fundingHist = hist;
  if (hist.length < 60) { ctx.watch([]); return null; }
  const win = hist.slice(-60);
  let below = 0;
  for (let k = 0; k < 60; k++) if (win[k] <= f) below++;
  const pct = below / 60;
  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'above', note: 'exit' }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (pct < 0.20) {
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'below', note: 'pct low' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  ctx.watch([]);
  return null;
}
