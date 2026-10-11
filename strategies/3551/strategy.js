/*
 * @coinsori-strategy v1
 * name: BTC ETH Relative-Strength Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC and ETH do not move in lockstep — they take turns leading. Holding only the stronger of the two, and switching when the leadership flips, rides the leading asset while avoiding the laggard's dead weight. This is a cross-sectional relative-strength rotation, a different family from single-symbol trend following.
 * When it buys and sells: Each symbol independently computes its 40-bar momentum (closed bars) and whether price is above its 100-bar average. Only the symbol with the HIGHEST momentum above its trend line is held. It buys when it becomes the leader, sells when it stops being the leader or its trend breaks. One position at a time.
 * When it does NOT work: In a broad market where BTC and ETH fall together, both are below their trend lines and the strategy sits in cash (safe, no upside). Rapid leadership flips in a choppy market cause whipsaw and fees. It never shorts, so a prolonged bear is simply a long cash hold.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.closes.at(-2);
  if (price == null) return null;

  // 40-bar momentum from CLOSED bars (ago=1 vs ago=41) — identical in backtest, paper and live.
  const cur = ctx.closes.at(-2);
  const past = ctx.closes.at(-42);
  if (cur == null || past == null || past <= 0) return null;
  const mom = cur / past - 1;

  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) return null;
  const trendOk = price > sma100;

  // share momentum across symbols via the run-wide state; rank the leader
  if (!ctx.state.mom) ctx.state.mom = {};
  ctx.state.mom[sym] = trendOk ? mom : -Infinity; // only rankable if above trend

  // find the current leader among all symbols in the run
  const momMap = ctx.state.mom;
  let leader = null, bestMom = -Infinity;
  for (const s in momMap) {
    if (momMap[s] > bestMom) { bestMom = momMap[s]; leader = s; }
  }
  const isLeader = leader === sym;

  const pos = ctx.position;
  if (pos > 0) {
    // exit if I am no longer the leader, or my own trend broke
    if (!isLeader || !trendOk) return { side: 'sell', qty: pos };
    return null;
  }

  // flat: buy only if I am the leader (and momentum is positive), and nothing is already held
  if (!isLeader || bestMom <= 0) return null;
  let totalHeld = 0;
  const syms = ctx.syms;
  if (syms) { for (const s of syms) totalHeld += ctx.pos(s); }
  if (totalHeld > 0) return null; // strict rotation: one position at a time

  const qty = (ctx.cash / price) * 0.98;
  if (qty <= 0) return null;
  return { side: 'buy', qty: qty };
}
