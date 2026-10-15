/*
 * @coinsori-strategy v1 (Cross-Sectional Momentum Rotation 1D)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto leadership is sticky — the coin that has been rising
 * the most over the last few months tends to keep leading. Instead of holding
 * every coin that is trending (the champion's approach), this strategy holds ONLY
 * the single strongest of BTC/ETH/SOL and switches to a new leader when one
 * overtakes it. This concentrates capital into the strongest trend and avoids
 * holding laggards that drag the basket down.
 * When it buys and sells: every day it ranks the three coins by their 90-day
 * return. It holds only the #1 coin, and only while that coin's 90-day return is
 * still positive. It sells when a different coin takes the lead, when the leader's
 * 90-day return turns negative, or when a 15% hard stop is hit.
 * When it does NOT work: in a broad bull where all three coins rise together, it
 * holds only one coin and misses the gains of the other two; and when leadership
 * flips frequently in a choppy market it switches too often and pays the spread
 * and fees on every switch.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 92) return null;
  const prevClose = c.at(-2);

  // maintain aligned closed-close history per symbol in shared state.
  // Only the last CLOSED close is pushed, so all symbols' series stay aligned
  // regardless of the order the engine calls each symbol's onUpdate.
  const st = ctx.state;
  if (!st.closes) st.closes = {};
  const arr = st.closes[sym] || [];
  arr.push(prevClose);
  if (arr.length > 100) arr.shift();
  st.closes[sym] = arr;

  // 90-day return for every symbol (needs 91 closed closes)
  const moms = {};
  let ready = 0;
  for (const s of ctx.syms) {
    const a = st.closes[s];
    if (a == null || a.length < 91) continue;
    moms[s] = a[a.length - 1] / a[a.length - 91] - 1;
    ready++;
  }
  if (ready < 2) return null;   // not enough history to rank

  // pick the single strongest asset; the absolute filter = leader must be positive
  let topSym = null;
  let topMom = -Infinity;
  for (const s in moms) {
    if (moms[s] > topMom) { topMom = moms[s]; topSym = s; }
  }
  const isTop = sym === topSym;
  const topPositive = topMom > 0;

  // volatility-targeted sizing: ~2% daily vol for the single position
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const stopPx = ctx.entryPx * 0.85;       // hard stop: 15% below entry
    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (!isTop) return { side: 'sell', qty: pos };         // lost the leadership
    if (!topPositive) return { side: 'sell', qty: pos };   // absolute momentum gone
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '15% stop' }]);
    return null;
  }

  if (!isTop || !topPositive) return null;   // only the leader, only in an uptrend
  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
