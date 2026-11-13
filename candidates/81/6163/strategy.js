/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT, XRP/USDT, DOGE/USDT
 * interval: 4h
 * cash: 10000
 *
 * Momentum rotation: once a week we rank a basket of large-cap coins by
 * their 42-day return and hold only the single strongest one (if any is
 * still rising), switching only at the next weekly review. Bet: in crypto
 * the recent winner tends to keep winning over weeks, and holding only the
 * top coin avoids the drag of laggards. Slow rebalancing keeps fees low.
 * When it does NOT work: sideways chop still flips the weekly lead and
 * fees eat the edge; in a sharp crash the leader has run up the most and
 * falls the hardest, so a 12% stop-loss is always armed.
 */
function onUpdate(ctx) {
  const LOOK = 252;       // 42 days of 4h bars — momentum horizon (6-week momentum: slower, more persistent)
  const REB = 42;         // rebalance every 42 bars = 1 week (standard rotation cadence, keeps fees low)
  const STOP = 0.12;      // hard stop: cut any position that drops 12% from entry (crash protection)
  const MIN_MOM = 0;      // only hold the leader while its momentum is positive (bear regime filter)

  if (ctx.closes.length < LOOK + 3) return null;

  const prevClose = ctx.closes.at(-2);
  const oldClose = ctx.closes.at(-2 - LOOK);
  if (oldClose == null || oldClose <= 0) return null;
  const mom = prevClose / oldClose - 1;

  // publish own momentum into shared state for the weekly ranking
  ctx.state = ctx.state || {};
  const st = ctx.state;
  st[ctx.sym] = mom;

  const basket = (ctx.syms && ctx.syms.length >= 2) ? ctx.syms : [ctx.sym];
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const stopLvl = entry != null ? entry * (1 - STOP) : null;

  // hard stop: the only action allowed mid-week (protects against a crash in the leader)
  if (pos > 0 && stopLvl != null && ctx.lows.at(-1) <= stopLvl) {
    ctx.watch([{ side: 'sell', price: stopLvl, trigger: 'below', note: '12% stop' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // next review time (epoch seconds) for the run card
  const barSec = (ctx.times.at(-1) - ctx.times.at(-2)) / 1000;
  const nextReb = Math.floor(ctx.times.at(-1) / 1000) + REB * barSec;

  // ranking only changes at the weekly review
  const isReb = (ctx.i % REB) === 0;
  if (!isReb) {
    if (pos > 0 && stopLvl != null) {
      ctx.watch([{ side: 'sell', price: stopLvl, trigger: 'below', note: '12% stop' },
                 { side: 'sell', at: nextReb, note: 'weekly review' }]);
    } else {
      ctx.watch([{ side: 'buy', at: nextReb, note: 'weekly review' }]);
    }
    return null;
  }

  // weekly review: pick the strongest rising coin
  let best = null;
  for (const s of basket) {
    const m = st[s];
    if (m == null) continue;
    if (best == null || m > best.mom) best = { sym: s, mom: m };
  }
  if (best == null) { ctx.watch([]); return null; }
  const isLeader = best.sym === ctx.sym && best.mom > MIN_MOM;

  if (pos > 0 && !isLeader) {
    ctx.watch([{ side: 'sell', at: nextReb, note: 'weekly review' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (pos <= 0 && isLeader) {
    ctx.watch([{ side: 'buy', at: nextReb, note: 'weekly review',
      conds: [{ label: '42d mom', now: mom, op: '>', ref: MIN_MOM, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  if (pos > 0 && stopLvl != null) {
    ctx.watch([{ side: 'sell', price: stopLvl, trigger: 'below', note: '12% stop' },
               { side: 'sell', at: nextReb, note: 'weekly review' }]);
  } else {
    ctx.watch([{ side: 'buy', at: nextReb, note: 'weekly review' }]);
  }
  return null;
}
