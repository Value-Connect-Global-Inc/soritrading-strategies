/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Momentum-Tilted VolTarget Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The equal-slice basket (5554) is validated but lags in a BTC-led bull
 * because one third of the account always sits in laggards. This version keeps the same
 * inverse-ATR vol-target engine but tilts each coin's slice toward whichever coin has the
 * strongest 30-day momentum, so a leading coin gets more capital and a lagging coin less.
 * When it buys and sells: Every day each coin is sized by inverse 14-day ATR toward a 2.5%
 * daily-vol budget, but the notional share per coin is weighted by its 30-day return stored
 * in shared state. Rebalances only when the target moves more than 20%.
 * When it does NOT work: In a broad bear all three coins fall together and the basket still
 * bleeds. Momentum tilts add churn in choppy ranges and can pile into a coin right before a
 * sharp reversal, so drawdown can be slightly higher than the equal-slice version.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  const sym = ctx.sym;
  const pos = ctx.pos(sym);

  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  const MEMBERS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

  // Each coin computes its own 30-day momentum (its own history) and stores it in shared
  // state. ctx.state is ONE object for all symbols, so every coin can read all three.
  const chg = ctx.change(30, 1);
  if (chg == null) return null;
  if (ctx.state.mom == null) ctx.state.mom = {};
  ctx.state.mom[sym] = chg;

  let slice = 1 / MEMBERS.length;
  const mom = ctx.state.mom;
  const allKnown = MEMBERS.every(m => typeof mom[m] === 'number');
  if (allKnown) {
    // Soft-max tilt: weight = exp(k*mom), k=6 gives a gentle tilt (~40% for a +10% leader).
    const k = 6;
    let sumExp = 0;
    for (const m of MEMBERS) sumExp += Math.exp(k * mom[m]);
    slice = Math.exp(k * mom[sym]) / sumExp;
  }

  const TARGET_VOL = 0.025;
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;

  const qtyTarget = slice * frac * equity / price;

  const threshold = 0.20;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) {
    return null;
  }

  if (qtyTarget > pos) {
    const qty = qtyTarget - pos;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'mom-tilt vol-target rebalance up' }]);
    return { side: 'buy', qty: qty };
  }
  if (qtyTarget < pos) {
    const qty = pos - qtyTarget;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'sell', note: 'mom-tilt vol-target rebalance down' }]);
    return { side: 'sell', qty: qty, reduceOnly: true };
  }
  return null;
}
