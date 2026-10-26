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
 * inverse-ATR vol-target engine but tilts the slice toward whichever coin has the strongest
 * 30-day momentum, so a leading coin gets more capital and a lagging coin gets less.
 * When it buys and sells: Every day each coin is sized by inverse 14-day ATR toward a 2.5%
 * daily-vol budget, but the notional share per coin is weighted by its 30-day return relative
 * to the other two coins. Rebalances only when the target moves more than 20%.
 * When it does NOT work: In a broad bear all three coins fall together and the basket still
 * bleeds. Momentum tilts also add churn in choppy ranges and can pile into a coin right before
 * a sharp reversal, so drawdown can be slightly higher than the equal-slice version.
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

  // Momentum of each member: 30-day return from closed bars (ago>=1, identical in backtest/live).
  // ctx.market(sym) exposes another symbol's history; if unavailable we fall back to equal slices.
  let mom = {};
  let haveMom = true;
  for (const m of MEMBERS) {
    let closes = null;
    try { closes = ctx.market(m).closes; } catch (e) { closes = null; }
    if (closes == null || closes.length < 32) { haveMom = false; break; }
    const p0 = closes[closes.length - 2];          // last closed bar
    const p1 = closes[closes.length - 2 - 30];     // 30 bars before that
    if (p0 == null || p1 == null || p1 <= 0) { haveMom = false; break; }
    mom[m] = p0 / p1 - 1;
  }

  let slice;
  if (haveMom) {
    // Soft-max style tilt: weight = exp(k*mom), k chosen so a coin leading by ~10% gets
    // roughly 40% of the account instead of 33% — a gentle, not extreme, tilt.
    const k = 6;
    let sumExp = 0;
    for (const m of MEMBERS) sumExp += Math.exp(k * mom[m]);
    slice = Math.exp(k * mom[sym]) / sumExp;
  } else {
    slice = 1 / MEMBERS.length;
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
