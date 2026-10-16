/*
 * @coinsori-strategy v1
 * name: Crypto Relative Strength Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, leadership rotates — when one asset is
 * outperforming, it tends to keep outperforming for a while. Cross-sectional
 * momentum holds the strongest of a small basket and rotates out when another
 * asset takes the lead, staying invested in the winning trend instead of
 * picking one asset and hoping.
 * When it buys and sells: each bar it ranks the basket by 20-bar return; it
 * holds the top asset (buy when it becomes #1 and we are flat, sell when it
 * loses the lead). A 15% hard stop limits each position.
 * When it does NOT work: in an all-rise market it rotates too often and pays
 * fees on top of holding both; in an all-fall market it always holds the
 * "least bad" and loses anyway. It needs persistent relative divergence to
 * earn its rotation costs.
 */
function onUpdate(ctx) {
  const syms = ctx.syms;
  const cur = ctx.sym;
  const c = ctx.closes;
  if (c.length < 30) return null;
  const prevClose = c.at(-2);
  const ref = c.at(-22);   // 20 closed bars ago
  if (ref == null || ref <= 0) return null;
  const mom = prevClose / ref - 1;   // 20-bar momentum for THIS symbol

  // Store momentum per symbol in persistent state (one-bar lag across symbols)
  const st = ctx.state || {};
  st.mom = st.mom || {};
  st.mom[cur] = mom;
  ctx.state = st;

  // Rank: pick the symbol with the highest known momentum
  let best = null;
  let bestMom = -Infinity;
  for (const s of syms) {
    const m = st.mom[s];
    if (m != null && m > bestMom) { bestMom = m; best = s; }
  }
  if (best == null) return null;

  const pos = ctx.pos(cur);
  const price = ctx.price;

  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (best !== cur) return { side: 'sell', qty: pos };   // lost leadership -> rotate out
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', note: 'losing momentum leadership' }]);
    return null;
  }

  if (best !== cur) return null;   // only hold the leader
  if (bestMom <= 0) return null;   // do not hold a falling asset

  ctx.watch([{ side: 'buy', note: 'strongest 20-bar momentum', conds: [{ label: 'mom', now: mom, op: '>', ref: 0, closed: true }] }]);
  const qty = (ctx.cash * 0.95 / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
