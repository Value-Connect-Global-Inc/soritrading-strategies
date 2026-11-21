/*
 * @coinsori-strategy v1
 * name: BTC Contrarian Fear-Greed 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto markets are driven by emotion, and extremes of
 * fear mark short-term capitulation bottoms while extremes of greed mark
 * short-term tops. This strategy is contrarian: it buys when the Fear &
 * Greed index is in extreme fear AND price is stretched well below its own
 * recent mean (a fast drop), then sells when price snaps back to the mean
 * or sentiment turns greedy. The bet is that panic selling is usually
 * overdone in the short run.
 * When it buys and sells: Buys BTC when the daily Fear & Greed index is
 * below 25 AND price is more than 2 standard deviations below its 50-bar
 * (about 8-day) average. Sells when price climbs back to that average, or
 * when the Fear & Greed index reaches 60 (greed), or immediately if price
 * falls 9% below the entry (hard stop).
 * When it does NOT work: in a real long bear market the index stays in
 * extreme fear for months while price keeps falling — the strategy buys
 * repeatedly into the knife and the stops grind the account down. It also
 * does nothing during long calm uptrends because it needs a panic to enter.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  const fg = ctx.data('fear_greed');
  const z = ctx.zscore(50, 1);   // how stretched price is from its ~8-day mean, in stdev (closed bar)
  if (fg == null || z == null) { ctx.watch([]); return null; }

  const close = ctx.closes.at(-2);

  // contrarian entry: extreme fear AND a fast, stretched drop
  const fear = fg < 25;
  const stretched = z < -2.0;

  // exits
  const reverted = z >= 0;        // price back to the mean
  const greedy = fg >= 60;        // sentiment turned greedy

  // hard stop: 9% below entry (crypto 4h swings are wide; tighter gets stopped out by noise)
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.91 : null;

  ctx.watch([
    { side: 'buy', price: close, trigger: 'below', note: 'extreme fear + stretched', conds: [
        { label: 'F&G < 25', now: fg, op: '<', ref: 25, closed: true },
        { label: 'z-score < -2', now: z, op: '<', ref: -2, closed: true }
      ] },
    { side: 'sell', price: close, trigger: 'above', note: 'reverted to mean', conds: [
        { label: 'z-score >= 0', now: z, op: '>=', ref: 0, closed: true }
      ] },
    { side: 'sell', price: 60, trigger: 'above', note: 'F&G greed', conds: [
        { label: 'F&G >= 60', now: fg, op: '>=', ref: 60, closed: true }
      ] },
    { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
  ]);

  // demoted / not-ok allocation: close position, no new entries
  if (ctx.alloc) {
    if (ctx.alloc.status === 'demoted' && pos !== 0) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    if (ctx.alloc.status !== 'ok') return null;
  }

  // exits
  if (pos !== 0) {
    if (reverted || greedy) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }

  // entry: flat, extreme fear + stretched drop
  if (fear && stretched) {
    const qty = (ctx.cash * 0.95) / price;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
