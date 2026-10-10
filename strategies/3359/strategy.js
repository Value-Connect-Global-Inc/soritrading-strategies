/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto bull markets the strongest coin leads and the others follow.
 * Instead of betting on one coin, this strategy ranks BTC, ETH and SOL every day by their
 * 60-day momentum and holds ONLY the leader — but only while that leader's momentum is still
 * positive. When the leader changes it rotates to the new one; when every coin's momentum
 * turns negative it steps to cash. This is a different family from the SOL mean-reversion
 * champion: it rides momentum instead of buying panic, so it is a bull-market engine with a
 * defensive cash rule.
 * When it buys and sells: Each day it compares the 60-day % change (of the last closed daily
 * bar) of BTC, ETH and SOL. It buys the strongest coin when it becomes the leader, sells a
 * coin the moment it is no longer the leader, sells when its 20-day momentum turns negative
 * or when price falls 20% below the highest close since entry (trailing stop that caps a
 * crash), and sells everything when the leader's 60-day momentum turns negative. A rotation
 * takes one extra day to settle so it never holds two coins at once.
 * When it does NOT work: In a choppy sideways market the leader changes often and rotation
 * bleeds fees. The three coins are highly correlated, so in a broad crash they all turn
 * negative at roughly the same time — the cash rule protects capital but the strategy is
 * also late to re-enter after a bottom. No data before Aug 2020 (SOL listing).
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const st = ctx.state;
  if (!st.mom) st.mom = {};

  // Momentum of THIS symbol: % change of the last closed daily bar vs 60 bars ago.
  // 60 days is long enough that the "leader" persists through normal pullbacks, short enough
  // to catch a real change of leadership within a few weeks.
  const c1 = ctx.closes.at(-2);
  const c60 = ctx.closes.at(-61);
  if (c1 == null || c60 == null || c60 <= 0) return null;
  st.mom[sym] = c1 / c60 - 1;

  const syms = (ctx.syms && ctx.syms.length) ? ctx.syms : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

  // Wait until every coin has reported its momentum for this bar (each symbol's onUpdate
  // runs on the same bar; ctx.state is shared across all of them).
  for (const s of syms) if (st.mom[s] == null) return null;

  // Leader = strongest momentum. If even the leader's momentum is negative, go to cash —
  // that is the bear-market rule: never hold a coin whose 60-day trend is down.
  let best = syms[0];
  for (const s of syms) if (st.mom[s] > st.mom[best]) best = s;
  const leader = st.mom[best] > 0 ? best : null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    // Fast crash protection: a 20% trailing stop below the highest close since entry catches
    // a crash days before the slow 60-day momentum can turn negative. 20% is wide enough to
    // survive normal crypto pullbacks, tight enough to cap a single bad ride.
    if (!st.peak) st.peak = {};
    if (st.peak[sym] == null || price > st.peak[sym]) st.peak[sym] = price;
    const trail = st.peak[sym] * 0.80;
    // Short-term trend exit: if the held coin's 20-day momentum turns negative it has already
    // started to roll over even if the 60-day momentum still looks positive.
    const c20 = ctx.closes.at(-21);
    const mom20 = c20 != null ? c1 / c20 - 1 : 0;
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: '20% trail' }]);
    if (leader !== sym || mom20 < 0 || price <= trail) {
      delete st.peak[sym];
      st.lastSellBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null; // still the leader, keep holding
  }

  // Flat: buy only when this coin became the leader AND the previous sell already settled
  // (ctx.i > lastSellBar) so the strategy never holds two coins in the same bar.
  if (leader === sym && (st.everBought == null || (st.lastSellBar != null && ctx.i > st.lastSellBar))) {
    st.everBought = true;
    st.lastSellBar = null;
    const qty = (ctx.cash / price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
