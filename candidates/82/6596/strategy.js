/*
 * @coinsori-strategy v1
 * name: BTC 4h Long-Short EMA Trend, Confirmed Entry (usdm)
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Long-only trend strategies give back gains in bear markets because
 * they can only sit out. This version uses perpetual futures to make money in BOTH
 * directions. The EMA50/EMA200 cross sets the direction; a confirmation gate (price on
 * the same side of EMA200) prevents entering chop right at the cross. Exits stay on the
 * SLOW cross signal so a brief price dip does not churn the position. Hard stops at 15%
 * cap any single losing position in a fast move against us.
 * When it buys: EMA50 above EMA200 AND price above EMA200 — go long.
 * When it sells: EMA50 below EMA200 AND price below EMA200 — go short.
 * When it does NOT work: in choppy sideways markets it stays flat and misses short
 * bounces; funding fees are paid every 8h and erode returns in flat markets. Results
 * include trading fees and funding (fundingMissing:false).
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const price = ctx.price;
  const pos = ctx.position; // negative = short position in futures
  const entry = ctx.entryPx;
  const up = e50 > e200;

  // entry gate only: do not enter right at the cross in chop, wait for price confirmation
  const longEntry = up && price > e200;
  const shortEntry = !up && price < e200;

  // hard stops: -15% for a long, +15% for a short
  const longStop = entry != null ? entry * 0.85 : 0;
  const shortStop = entry != null ? entry * 1.15 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'confirmed up: long', conds:[{label:'price>EMA200', ok: price > e200}, {label:'EMA50', now: e50, op:'>', ref: e200, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'confirmed down: short', conds:[{label:'price<EMA200', ok: price < e200}, {label:'EMA50', now: e50, op:'<', ref: e200, closed:true}] },
    ...(pos > 0 ? [{ side:'sell', price: longStop, trigger:'below', note:'long hard stop' }] : []),
    ...(pos < 0 ? [{ side:'buy', price: shortStop, trigger:'above', note:'short hard stop' }] : [])
  ]);

  if (pos > 0) {
    // exit on the SLOW cross flip (not a price dip) or the hard stop
    if (!up || (entry != null && price <= longStop)) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    if (up || (entry != null && price >= shortStop)) {
      return { side:'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // flat: open a 1x position only in a confirmed trend
  const equity = ctx.cash + ctx.uPnl;
  if (longEntry) return { side:'buy', qty: (equity / price) * 0.99 };
  if (shortEntry) return { side:'sell', qty: (equity / price) * 0.99 };
  return null;
}
