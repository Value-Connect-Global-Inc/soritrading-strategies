/*
 * @coinsori-strategy v1
 * name: BTC 4h Funding Panic Contrarian
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: When the funding rate turns deeply negative, short sellers are crowded and paying
 * longs — a short squeeze is likely. Funding is positioning/sentiment data, a different family from the
 * price and macro gates used elsewhere. We buy the panic dip only while the long-term uptrend is intact,
 * so we never catch a falling knife in a bear market.
 * When it buys: funding rate below its own 25th percentile (shorts crowded) AND price above EMA200.
 * When it sells: +25% take profit, or price falls below EMA200 (trend broke), or a -15% hard stop.
 * When it does NOT work: in a grinding bear market funding stays negative for months and the EMA200
 * filter keeps us in cash (we miss the bottom but also avoid the knife); in a long euphoric melt-up
 * funding rarely turns negative so we sit out most of the rally.
 */
function onUpdate(ctx) {
  const funding = ctx.funding;
  if (funding == null) return null;

  // rolling history of the funding rate (dedupe: the same rate repeats on 4h bars until the next 8h funding tick)
  let fHist = ctx.state.fHist || [];
  const fLast = fHist.length ? fHist[fHist.length - 1] : null;
  if (fLast === null || Math.abs(fLast - funding) > 1e-12) {
    fHist = fHist.concat([funding]);
    if (fHist.length > 90) fHist = fHist.slice(-90);
    ctx.state.fHist = fHist;
  }
  if (fHist.length < 30) return null; // need ~10 days of funding history for a stable percentile

  const sorted = fHist.slice().sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  const low = q(0.25); // 25th percentile = panic threshold (self-adapting to regime)
  const panic = funding <= low;

  const e200 = ctx.ema(200, 1);
  if (e200 == null) return null;
  const price = ctx.price;
  const inPos = ctx.position > 0;
  const up = price > e200;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.85 : 0;
  const target = ctx.entryPx != null ? ctx.entryPx * 1.25 : 0;
  const ready = ctx.state.cooldownUntil == null || ctx.i >= ctx.state.cooldownUntil;

  ctx.watch([
    ...(inPos ? [
      { side:'sell', price: target, trigger:'above', note:'take profit' },
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [
      { side:'buy', price: e200, trigger:'above', note:'panic + uptrend', conds:[
        { label:'funding<=25pct', ok: panic },
        { label:'cooldown over', ok: ready }
      ]}
    ])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price >= target || price <= stop || !up) {
      ctx.state.cooldownUntil = ctx.i + 12; // 2-day cooldown after each exit to cut churn
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }
  if (panic && up && ready) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
