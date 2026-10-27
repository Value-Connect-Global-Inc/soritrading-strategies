/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 4-Asset 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: instead of betting on one asset's trend, this strategy
 * bets that crypto leaders persist for a while — the asset with the strongest
 * 90-day momentum tends to keep outperforming. It rotates the whole position
 * into whichever of the four majors has the strongest momentum, so it always
 * rides the current leader instead of being stuck in a laggard.
 * When it buys and sells: each day it ranks the four assets by 90-day price
 * momentum. It holds only the #1 asset, and only when that momentum is
 * positive and price is above its 200-day average; otherwise it stays in
 * cash. When another asset takes the #1 spot, it sells the old one and buys
 * the new one. A cooldown prevents flipping back and forth.
 * When it does NOT work: when the leader keeps changing every few weeks the
 * rotation churns and pays fees; in a bear market all four assets fall
 * together so it sits in cash and misses nothing but also gains nothing;
 * a single asset's melt-up is only partially captured because it must stay
 * the momentum leader.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // 90-day price momentum from a CLOSED bar — stable across the bar, so the
  // ranking below is consistent for all four symbols in the same bar.
  const mom = ctx.change(90, 1);
  if (mom == null) return null;

  const st = ctx.state;
  if (!st.mom) st.mom = {};
  st.mom[sym] = mom;

  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;

  // Wait until every symbol has reported momentum at least once.
  let allKnown = true;
  for (const s of syms) {
    if (st.mom[s] == null) { allKnown = false; break; }
  }
  if (!allKnown) return null;

  // Find the #1 momentum symbol (strict inequality -> no ties).
  let top = null, topMom = -Infinity;
  for (const s of syms) {
    if (st.mom[s] > topMom) { topMom = st.mom[s]; top = s; }
  }
  const isTop = (sym === top);
  const momPositive = mom > 0;

  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'lost #1 momentum', conds: [{ label: 'not top momentum', ok: !isTop }] }
    ]);
    // Exit when no longer the leader, momentum turns negative, or trend breaks.
    if ((!isTop || !momPositive || price < sma200) && cd === 0) {
      st.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'momentum leader entry', conds: [
      { label: 'is #1 momentum', ok: isTop },
      { label: 'momentum > 0', ok: momPositive },
      { label: 'Price > SMA200', ok: price > sma200 }
    ]}
  ]);
  if (isTop && momPositive && price > sma200 && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    st.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
