/*
 * @coinsori-strategy v1
 * name: OnChain Adoption Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto bull markets are driven by new users and new
 * mining capacity, both visible on-chain before they fully show up in price.
 * Raw daily active-address counts are too noisy to trade directly, so this
 * strategy watches the TREND of the smoothed 30-day averages instead: when
 * the 30-day average of active addresses is rising AND the 30-day average of
 * hash rate is rising, the network is in a growth regime and price tends to
 * follow. This is a slow bet on adoption — a different family from price
 * trend or sentiment indexes.
 * When it buys and sells: buy when the 30-day average of active addresses
 * and of hash rate are both higher than they were 7 days earlier (growth
 * regime, judged on closed daily bars). Hold while that growth persists.
 * Sell when the 30-day average of active addresses turns down, or if price
 * drops 25% below entry (hard stop).
 * When it does NOT work: in a mature market where price moves on macro
 * liquidity (interest rates, dollar) while on-chain usage stays flat, this
 * stays on the sidelines and misses rallies. Address growth can also lag a
 * crash, so the exit is late.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const a30 = ctx.data('addr_sma30');
  const h30 = ctx.data('hashrate_sma30');
  // Both smoothed series must be present; null means unknown, never trade on it.
  if (a30 == null || h30 == null) return null;

  // Persistent ring buffer of the smoothed series so we can judge their
  // TREND (7 bars back) instead of churning on raw daily noise.
  const st = ctx.state || {};
  const bufA = st.bufA || [];
  const bufH = st.bufH || [];
  bufA.push(a30);
  bufH.push(h30);
  if (bufA.length > 15) bufA.shift();
  if (bufH.length > 15) bufH.shift();
  st.bufA = bufA;
  st.bufH = bufH;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // Hard stop: 25% because the regime exit is slow (daily data) and
      // cannot protect against a fast crash on its own.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Regime exit: smoothed address trend turned down.
    if (bufA.length >= 15 && a30 < bufA[bufA.length - 8]) return { side: 'sell', qty: pos };
    return null;
  }

  // Regime entry: BOTH smoothed series higher than 7 bars ago (growth).
  if (bufA.length >= 15 && bufH.length >= 15) {
    const aPrev = bufA[bufA.length - 8];
    const hPrev = bufH[bufH.length - 8];
    if (a30 > aPrev && h30 > hPrev) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
