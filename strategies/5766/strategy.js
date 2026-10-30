/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation Chandelier 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest asset in a bull phase keeps leading — relative strength persists for weeks. Hold the single strongest uptrend symbol and rotate when another takes the lead. Improvement over the base rotation: add a chandelier trailing stop — exit when price closes 20% below the highest close of the last 60 bars — so a momentum leader's sharp pullback cannot turn into a 50%+ drawdown. Anchored to a rolling high, so it needs no persistent state.
 * When it buys and sells: Every bar, rank the symbols by 30-bar momentum (closed bars), keep only those above their 200-bar average. Hold the top-ranked one; sell when it loses the top rank, drops below its 200-bar average, or closes 20% below its 60-bar highest close (chandelier trailing stop).
 * When it does NOT work: In a broad bear market no symbol is above its 200-bar average, so it stays flat. In choppy sideways markets rank flips churn fees. A leader that pulls back more than 20% from its recent high on a normal correction gets stopped out and may miss the next leg up.
 */
function onUpdate(ctx) {
  const momN = 30;
  const smaN = 200;
  const hiN = 60;
  const trailPct = 0.20; // exit 20% below the 60-bar highest close

  function rankOf(m) {
    if (m == null) return null;
    const closes = m.closes;
    if (closes == null || closes.length < smaN + 2) return null;
    const px = closes.at(-1);
    const prev = closes.at(-2);
    const momRef = closes.at(-2 - momN);
    if (momRef == null) return null;
    let sum = 0, hi = -Infinity;
    for (let k = 1; k <= smaN; k++) sum += closes.at(-1 - k);
    for (let k = 0; k < hiN; k++) { const c = closes.at(-1 - k); if (c > hi) hi = c; }
    const sma = sum / smaN;
    if (px <= sma) return null;
    return { mom: prev / momRef - 1, px: px, hi: hi };
  }

  const entries = [{ sym: ctx.sym, m: ctx }];
  const nRefs = (ctx.refs && ctx.refs.length) ? ctx.refs.length : 0;
  for (let i = 0; i < nRefs; i++) {
    const rm = ctx.ref(i);
    const rs = (ctx.syms && ctx.syms[i + 1]) ? ctx.syms[i + 1] : ('ref' + i);
    entries.push({ sym: rs, m: rm });
  }

  let best = null;
  for (const e of entries) {
    const r = rankOf(e.m);
    if (r == null) continue;
    if (best == null || r.mom > best.mom) best = { sym: e.sym, mom: r.mom, px: r.px };
  }

  let held = null;
  for (const e of entries) {
    const p = ctx.pos(e.sym);
    if (p != null && p.position > 0) { held = { sym: e.sym, qty: p.position }; break; }
  }

  if (held != null) {
    const hm = entries.find(e => e.sym === held.sym);
    const r = hm ? rankOf(hm.m) : null;
    const stopPx = (r != null) ? r.hi * (1 - trailPct) : null;
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'chandelier trailing stop' }
    ]);
    const stillBest = best != null && best.sym === held.sym;
    if (!stillBest || r == null || r.px < stopPx) {
      return { side: 'sell', sym: held.sym, qty: held.qty, reduceOnly: true };
    }
    return null;
  }

  if (best != null) {
    const bm = entries.find(e => e.sym === best.sym);
    const px = bm.m.closes.at(-1);
    return { side: 'buy', sym: best.sym, qty: ctx.cash / px * 0.95 };
  }

  return null;
}
