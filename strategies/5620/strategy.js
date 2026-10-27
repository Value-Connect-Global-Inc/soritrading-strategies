/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 4-Asset 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto leaders persist for a while, so the asset with the
 * strongest 180-day momentum tends to keep outperforming. This rotates the
 * whole position into the strongest of four majors. The first version churned
 * (rotating into marginally-stronger losers), so this uses a longer 180-day
 * momentum and a takeover HYSTERESIS: it only switches when the new leader is
 * clearly stronger (at least 10% more momentum), and only exits the current
 * holding when another asset is clearly ahead. This keeps it from flipping
 * between closely-ranked assets.
 * When it buys and sells: ranks the four assets by 180-day momentum. Holds the
 * leader only when its momentum is positive and price is above its 200-day
 * average. Switches to a new asset only when that asset's momentum is at least
 * 10% above the current holding's; otherwise it stays put. A cooldown further
 * cuts churn.
 * When it does NOT work: in a bear market all four fall together so it sits in
 * cash; when leadership genuinely churns every few weeks the hysteresis still
 * forces occasional switches and fees; a single asset's melt-up is only partly
 * captured because it must stay the leader.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // 180-day momentum from a CLOSED bar — stable across the bar, consistent ranking.
  const mom = ctx.change(180, 1);
  if (mom == null) return null;

  const st = ctx.state;
  if (!st.mom) st.mom = {};
  st.mom[sym] = mom;

  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;

  let allKnown = true;
  for (const s of syms) {
    if (st.mom[s] == null) { allKnown = false; break; }
  }
  if (!allKnown) return null;

  // Global #1 by raw momentum.
  let top = null, topMom = -Infinity;
  for (const s of syms) {
    if (st.mom[s] > topMom) { topMom = st.mom[s]; top = s; }
  }
  const isGlobalTop = (sym === top);
  const momPositive = mom > 0;

  // The asset we currently hold (persisted so all four symbols share it).
  const holding = st.holding || null;

  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'lost clear lead', conds: [{ label: 'new leader 1.10x ahead', ok: !isGlobalTop && topMom > mom * 1.10 }] }
    ]);
    // Exit only when another asset is CLEARLY ahead (10% more momentum), or
    // momentum turned negative, or the trend broke. A marginal flip is ignored.
    const clearlyBehind = !isGlobalTop && topMom > mom * 1.10;
    const exitNow = (clearlyBehind || !momPositive || price < sma200);
    if (exitNow && cd === 0) {
      st.cd = 5;
      st.holding = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter only if THIS symbol is the global #1 with positive momentum in an uptrend.
  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'momentum leader entry', conds: [
      { label: 'is #1 momentum', ok: isGlobalTop },
      { label: 'momentum > 0', ok: momPositive },
      { label: 'Price > SMA200', ok: price > sma200 }
    ]}
  ]);
  if (isGlobalTop && momPositive && price > sma200 && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    st.cd = 5;
    st.holding = sym;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
