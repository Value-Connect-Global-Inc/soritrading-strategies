/*
 * @coinsori-strategy v1
 * name: VIX Panic Dip-Buy BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: when VIX spikes far above its own 90-day average, markets are in panic and crypto is usually oversold; buying that panic and selling once VIX calms down has historically caught the bottom of crypto crashes.
 * When it buys and sells: buys when VIX is at least 1.5 standard deviations above its own 90-day average (panic); sells when VIX falls back to normal (below +0.5 stdev), or a 15% hard stop is hit.
 * When it does NOT work: in a long grinding bear market VIX can stay elevated for months — the strategy keeps buying early and taking 15% stops; also a panic that keeps panicking (protracted crisis) breaks the stop repeatedly.
 */

function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) return null;

  // Rolling 90-day VIX history in restart-safe state (VIX updates ~daily).
  const st = ctx.state;
  if (!st.vixHist) st.vixHist = [];
  if (st.vixHist.length === 0 || Math.abs(st.vixHist[st.vixHist.length - 1] - vix) > 1e-9) {
    st.vixHist.push(vix);
    if (st.vixHist.length > 90) st.vixHist.shift();
  }
  if (st.vixHist.length < 60) return null; // need ~60 days of VIX history before the z-score is trustworthy

  let sum = 0;
  for (let i = 0; i < st.vixHist.length; i++) sum += st.vixHist[i];
  const mean = sum / st.vixHist.length;

  let ss = 0;
  for (let i = 0; i < st.vixHist.length; i++) ss += (st.vixHist[i] - mean) * (st.vixHist[i] - mean);
  const sd = Math.sqrt(ss / st.vixHist.length);
  if (sd < 1e-9) return null;
  const vz = (vix - mean) / sd; // VIX z-score vs its own recent history

  const price = ctx.price;
  const inPos = ctx.position > 0;

  if (!inPos) {
    ctx.watch([{
      side: 'buy', price: price, trigger: 'below', note: 'VIX panic',
      conds: [{ label: 'VIX z-score', now: vz, op: '>=', ref: 1.5, closed: true }]
    }]);
    if (vz >= 1.5) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
    }
    return null;
  }

  // In position: exit when VIX normalizes (z <= 0.5) or hard stop.
  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.85 : null;
  ctx.watch([
    { side: 'sell', price: price, trigger: 'above', note: 'VIX normalized', conds: [{ label: 'VIX z-score', now: vz, op: '<=', ref: 0.5, closed: true }] },
    { side: 'sell', price: stopPx, trigger: 'below', note: '15% hard stop' }
  ]);

  if (vz <= 0.5) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
