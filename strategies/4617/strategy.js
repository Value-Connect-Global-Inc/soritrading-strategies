/*
 * @coinsori-strategy v1
 * name: Momentum Rotation Breadth Gated 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the plain momentum rotation (top-2 of four by
 * EMA50/200 momentum) was the strongest result this job (+490/+87/+31 on
 * three disjoint 4h windows) but its documented failure is a broad meltdown
 * where ALL coins fall together and the rotation keeps buying the least-bad
 * "leader". This adds a market-breadth gate: when the average momentum of the
 * whole basket turns negative, the market is in a broad decline and we go
 * fully flat instead of holding the least-bad coin.
 * When it buys and sells: each coin records its EMA50/200 momentum in shared
 * state; buy a coin only when it is one of the two strongest AND the basket's
 * average momentum is positive (breadth is healthy). Sell on the death cross,
 * the 2.5-ATR stop, dropping out of the top two, or when breadth turns
 * negative (all coins declining). 24-bar cooldown after an exit.
 * When it does NOT work: when leadership rotates quickly the rotation still
 * churns and pays fees on lag; in a slow grind higher where the average
 * momentum stays just above zero the breadth gate adds little. It is long-only,
 * so a sustained bear is flat-to-loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  if (f == null || s == null || s <= 0) return null;
  const mom = f / s - 1;

  const st = ctx.state || {};
  if (!st.mom) st.mom = {};
  st.mom[ctx.sym] = mom;

  // Market breadth = average momentum of the whole basket. Negative means all
  // coins are broadly declining — the rotation's known failure mode.
  const vals = Object.values(st.mom);
  let avgMom = 0;
  for (let i = 0; i < vals.length; i++) avgMom += vals[i];
  avgMom = vals.length > 0 ? avgMom / vals.length : 0;
  const breadthOk = avgMom > 0;

  const ranked = Object.keys(st.mom).sort((a, b) => st.mom[b] - st.mom[a]);
  const top2 = ranked.slice(0, 2);
  const inTop2 = top2.indexOf(ctx.sym) !== -1;

  const sym = ctx.sym;
  if (!st.cool) st.cool = {};
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    // Exit on breadth collapse too — don't hold the least-bad coin in a meltdown.
    if (!inTop2 || f <= s || !breadthOk || price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR' }]);
    return null;
  }

  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;
  if (!inTop2 || mom < 0.02 || !breadthOk) return null;

  const riskCash = ctx.cash * 0.0125;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
