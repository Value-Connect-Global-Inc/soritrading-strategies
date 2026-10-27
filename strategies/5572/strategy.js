/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Momentum Rotation 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto the strongest coin tends to keep leading (relative
 * strength persists for weeks). This strategy holds ONLY the coin with the best
 * 30-day momentum, so during a bull it concentrates in the winner instead of being
 * diluted by laggards. It is long only when the leader itself is still trending up
 * (positive momentum) — never holding a falling coin — so a broad bear sends it to
 * cash instead of riding the "least bad" loser down.
 * When it buys and sells: Every 7 days it compares the 30-day return of BTC, ETH and
 * SOL (on closed bars) and holds the strongest. It switches only when a new leader
 * beats the current one by at least 5% (hysteresis), so small daily rank flips do not
 * cause churn. If the leader's own momentum turns negative it sells to cash.
 * When it does NOT work: When the three coins move together the concentration means a
 * single coin's crash hits the whole account. The weekly re-check can also enter a
 * leader just as its run ends. And momentum is a lagging signal: it misses the very
 * start of a new bull because it needs 30 days of proof first.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 32) return null;

  // 30-day momentum on CLOSED bars (ago>=1): last closed close vs 30 bars before it.
  const mom = closes.at(-2) / closes.at(-31) - 1;
  if (!isFinite(mom)) return null;

  // Restart-surviving shared state: each coin stores its own momentum; decision reads all.
  let st = ctx.state || {};
  if (typeof st.mom !== 'object') st.mom = {};
  st.mom[ctx.sym] = mom;
  if (typeof st.lastEval !== 'number') st.lastEval = -9999;
  ctx.state = st;

  const syms = ctx.syms;
  if (syms == null || syms.length < 3) return null;
  let ready = true;
  for (const s of syms) { if (typeof st.mom[s] !== 'number') { ready = false; break; } }
  if (!ready) return null;

  const pos = ctx.pos(ctx.sym);
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  // Weekly evaluation gate: decide only every 7 bars (all coins share the same bar index).
  if (ctx.i - st.lastEval < 7) {
    // Still enforce the "don't hold a falling coin" rule every day.
    const myMom = st.mom[ctx.sym];
    if (pos != null && pos > 0 && myMom < 0) {
      ctx.watch([{ side: 'sell', note: 'leader momentum negative - to cash' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  st.lastEval = ctx.i;

  // Leader = strongest momentum; only go long if the leader is itself trending up.
  let leader = syms[0];
  for (const s of syms) { if (st.mom[s] > st.mom[leader]) leader = s; }
  const leaderMom = st.mom[leader];

  // Currently holding a coin: sell if it lost leadership by >5% or its trend turned down.
  if (pos != null && pos > 0) {
    const myMom = st.mom[ctx.sym];
    const sellIt = ctx.sym !== leader && myMom < leaderMom * 0.95;
    if (sellIt || myMom < 0) {
      ctx.watch([{ side: 'sell', note: 'lost leadership or trend down - exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: buy the leader only if it is trending up.
  if (leaderMom > 0 && ctx.sym === leader) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'leader with positive momentum' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
