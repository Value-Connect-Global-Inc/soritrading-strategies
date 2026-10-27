/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Momentum Rotation 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto the strongest coin tends to keep leading (relative
 * strength persists for weeks). Instead of holding all three coins equally like the
 * champion basket, this strategy holds ONLY the one with the best 30-day momentum,
 * so during a bull it concentrates in the winner instead of being diluted by laggards.
 * It is ALWAYS invested in exactly one coin — never in cash — so it keeps the
 * V-recovery edge that timing strategies lose.
 * When it buys and sells: Each day it compares the 30-day return of BTC, ETH and SOL
 * (on closed bars) and holds the strongest. When a different coin takes the lead, it
 * sells the old one and buys the new leader. It only switches when a coin has clearly
 * taken the lead, to avoid churning on small rank flips.
 * When it does NOT work: When the three coins move together (correlated), rotation adds
 * nothing and the concentration means a single coin's crash hits the whole account —
 * drawdown can be HIGHER than the diversified basket. It also whipsaws in a sideways
 * market where leadership flips back and forth, paying fees on every switch.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 32) return null;

  // 30-day momentum on CLOSED bars (ago>=1): last closed close vs 30 bars before it.
  const mom = closes.at(-2) / closes.at(-31) - 1;
  if (!isFinite(mom)) return null;

  // Restart-surviving state: each coin stores its own latest momentum; the decision
  // reads all three so the strategy knows who the current leader is.
  let st = ctx.state || {};
  if (typeof st.mom !== 'object') st.mom = {};
  st.mom[ctx.sym] = mom;
  ctx.state = st;

  const syms = ctx.syms;
  if (syms == null || syms.length < 3) return null;
  let ready = true;
  for (const s of syms) { if (typeof st.mom[s] !== 'number') { ready = false; break; } }
  if (!ready) return null;

  // Leader = the coin with the best stored momentum.
  let leader = syms[0];
  for (const s of syms) { if (st.mom[s] > st.mom[leader]) leader = s; }

  const pos = ctx.pos(ctx.sym);
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  // Always hold exactly the leader: sell if I am holding a non-leader.
  if (ctx.sym !== leader && pos != null && pos > 0) {
    ctx.watch([{ side: 'sell', note: 'lost leadership - rotate out' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // Buy the leader if I am not holding it (full account into the winner).
  if (ctx.sym === leader && (pos == null || pos <= 0)) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'took leadership - full position' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
