/*
 * @coinsori-strategy v1
 * name: DXY Hist Probe 3
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — accumulates dxy into state and buys once the
 * array has 2 entries, using only the exact pattern that worked in probe 4400.
 * When it buys and sells: buys once when dxyHist.length >= 2, never sells.
 * When it does NOT work: every time — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  const dxyNow = ctx.data('dxy');
  if (dxyNow != null) st.dxyHist.push(dxyNow);
  if (st.dxyHist.length < 2) return null;
  if (ctx.position > 0) return null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
}
