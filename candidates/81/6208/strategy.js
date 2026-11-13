/*
 * @coinsori-strategy v1
 * name: Alt Momentum Rotation Top1 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Cross-sectional momentum rotation. Instead of betting on one symbol it
 * ranks five liquid alts by their recent return and holds only the strongest. This is a
 * different return source than single-symbol trend following: it captures the melt-up of
 * whichever asset leads (SOL in 2021, BTC in 2023) and sits in cash when every asset is
 * falling. No external data — it works on any exchange that lists these pairs.
 * When it buys and sells: every 4h bar it ranks BTC/ETH/SOL/BNB/XRP by their return over
 * the last ~17 days (100 4h bars). It buys the #1 asset when its own momentum is positive;
 * it switches only when a rival beats the held asset by a 2% buffer (anti-churn); a hard
 * -20% stop cuts any position that crashes faster than the rank can react.
 * When it does NOT work: when leadership flips every few bars it churns and pays fees; in a
 * one-asset melt-up where the leader is the asset you would have held anyway there is little
 * edge; in a broad bear it sits in cash (safe but no upside).
 */
function onUpdate(ctx) {
  const M = 100;     // momentum lookback in 4h bars (~17 days)
  const HYST = 0.02; // switch only when a rival beats the leader by 2% (anti-churn)
  const STOP = 0.80; // hard disaster stop: -20% from entry
  const sym = ctx.sym;

  // momentum for every symbol in the universe (closed bars only, so backtest == live)
  const scores = {};
  const univ = Array.isArray(ctx.syms) ? ctx.syms : [sym];
  let leader = null;
  let leaderMom = -Infinity;
  for (const s of univ) {
    const m = s === sym ? null : ctx.market(s);
    const closes = s === sym ? ctx.closes : (m != null ? m.closes : null);
    if (closes == null || closes.length < M + 3) continue;
    const now = closes.at(-2);
    const ago = closes.at(-2 - M);
    if (now == null || ago == null || ago <= 0) continue;
    const mom = now / ago - 1;
    scores[s] = mom;
    if (mom > leaderMom) { leaderMom = mom; leader = s; }
  }
  if (leader == null) { ctx.watch([]); return null; }

  if (ctx.i % 200 === 0) ctx.log('scores=' + JSON.stringify(scores) + ' leader=' + String(leader));

  const myMom = scores[sym] != null ? scores[sym] : -Infinity;
  const isLeader = sym === leader;
  const pos = ctx.pos(sym);
  const price = ctx.price;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    const stop = entryPx != null ? entryPx * STOP : null;
    const watchList = [];
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop -20%' });
    watchList.push({ side: 'sell', price: price, trigger: 'below', note: 'lost leadership', conds: [{ label: 'rank gap', now: leaderMom - myMom, op: '>', ref: HYST, closed: true }] });
    ctx.watch(watchList);
    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (leaderMom - myMom > HYST) return { side: 'sell', qty: pos, reduceOnly: true };
    if (myMom < 0) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (isLeader && leaderMom > 0) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'top rank entry', conds: [{ label: 'mom(100) close', now: myMom, op: '>', ref: 0, closed: true }, { label: 'top rank', ok: true }] }]);
    const qty = (ctx.cash / price) * 0.98;
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'waiting top rank', conds: [{ label: 'mom(100) close', now: myMom, op: '>', ref: 0, closed: true }] }]);
  return null;
}
