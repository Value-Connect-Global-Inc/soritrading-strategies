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
 * When it buys and sells: Once a week it ranks the 5 assets by trailing 90-day momentum
 * and holds only the #1-ranked asset while it has positive momentum. It sells whatever it
 * held and buys the new leader only at the weekly rebalance, so it does not churn daily.
 * When it does NOT work: In a broad coordinated crash every asset falls together, so the
 * leader also drops. In a choppy sideways market with no persistent leader, weekly ranking
 * still churns and pays fees. It also misses a single asset's straight-line melt-up if that
 * asset is overtaken at rebalance.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const lookback = 90;
  const myMom = ctx.change(lookback, 1);
  if (myMom == null) return null;

  // Weekly rebalance cadence: only re-rank on every 7th bar to avoid daily churn.
  if (ctx.i % 7 !== 0) {
    // Between rebalances, just trail a stop on whatever we hold.
    const pos = ctx.position;
    if (pos > 0) {
      const atr = ctx.atr(14, 1);
      if (atr != null && atr > 0) {
        const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
        ctx.state.peak = peak;
        // 3 ATR below the peak: let winners run, cut a real reversal.
        if (price < peak - 3 * atr) {
          ctx.state.peak = null;
          return { side: 'sell', qty: pos, reduceOnly: true };
        }
      }
    }
    return null;
  }

  // Rebalance day: rank all symbols by trailing momentum.
  let mkts;
  try { mkts = ctx.markets(); } catch (e) { return null; }
  if (mkts == null || mkts.length === 0) return null;

  let bestSym = sym;
  let bestMom = myMom;
  for (const m of mkts) {
    const s = m.sym;
    if (s == null) continue;
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

  if (!amLeader) {
    if (pos > 0) {
      ctx.state.peak = null;
      ctx.state.held = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos > 0) { ctx.state.peak = price; return null; }
  const qty = (ctx.cash / price) * 0.99;
  if (qty <= 0) return null;
  ctx.state.peak = price;
  ctx.state.held = sym;
  return { side: 'buy', qty: qty };
}
