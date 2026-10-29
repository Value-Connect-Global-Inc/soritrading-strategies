/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest asset in a bull phase keeps leading while
 * laggards stay flat. Cross-sectional momentum rotation holds only the single strongest
 * of 5 large-cap assets, so capital rides the leader instead of being diluted across a
 * basket. A different family from the trend/breakout/mean-reversion strategies tried.
 * When it buys and sells: On each symbol, it compares its own trailing momentum to the
 * other 4 symbols. It holds (buys) only when IT is the top-ranked asset with positive
 * momentum, and sells when it is no longer the leader.
 * When it does NOT work: In a broad coordinated crash every asset falls together, so the
 * leader also drops. In a choppy sideways market with no persistent leader, ranking churns
 * and pays fees. It also misses a single asset's straight-line melt-up if that asset is
 * overtaken at rebalance.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const lookback = 90;
  const myMom = ctx.change(lookback, 1);
  if (myMom == null) return null;

  // Rank all symbols by trailing momentum using ctx.markets()
  let mkts;
  try { mkts = ctx.markets(); } catch (e) { return null; }
  if (mkts == null || mkts.length === 0) return null;

  let bestSym = sym;
  let bestMom = myMom;
  for (const m of mkts) {
    const s = m.sym;
    if (s == null) continue;
    const r = ctx.change(lookback, 1); // NOTE: this reads THIS symbol's closes, see below
    // fallback: use market's own close if available
    let r2 = myMom;
    if (m.closes != null && m.closes.length > lookback + 2) {
      const now = m.closes.at(-2);
      const then = m.closes.at(-2 - lookback);
      if (Number.isFinite(now) && Number.isFinite(then) && then > 0) {
        r2 = (now / then - 1) * 100;
      }
    }
    if (r2 > bestMom) { bestMom = r2; bestSym = s; }
  }

  const pos = ctx.position;
  const amLeader = bestSym === sym && bestMom > 0;

  // If I am the leader and flat, buy. If I hold but am no longer leader, sell.
  if (!amLeader) {
    if (pos > 0) {
      ctx.state.held = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos > 0) return null; // still holding, still leader
  const qty = (ctx.cash / price) * 0.99;
  if (qty <= 0) return null;
  ctx.state.held = sym;
  return { side: 'buy', qty: qty };
}
