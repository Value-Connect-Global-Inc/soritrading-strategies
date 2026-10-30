/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest asset in a bull phase keeps leading — relative strength persists for weeks. Instead of betting on one coin, hold the single strongest uptrend symbol and rotate when another takes the lead. This cross-sectional family is untested in this job (all prior strategies were single-symbol).
 * When it buys and sells: Every bar, rank the symbols by 30-bar momentum (closed bars), keep only those above their 200-bar average (uptrend filter). Hold the top-ranked one; sell it when it loses the top rank or drops below its 200-bar average.
 * When it does NOT work: In a broad bear market no symbol is above its 200-bar average, so the strategy stays flat (safe but flat). In a choppy sideways market with frequent rank flips, rotation churns and fees eat returns. A single asset ripping higher while the others lag still only earns 1x — no leverage on the winner.
 */
function onUpdate(ctx) {
  const momN = 30;
  const smaN = 200;

  function rankOf(m) {
    if (m == null) return null;
    const closes = m.closes;
    if (closes == null || closes.length < smaN + 2) return null;
    const px = closes.at(-1);
    const prev = closes.at(-2);
    const momRef = closes.at(-2 - momN);
    if (momRef == null) return null;
    let sum = 0;
    for (let k = 1; k <= smaN; k++) sum += closes.at(-1 - k);
    const sma = sum / smaN;
    if (px <= sma) return null;
    return { mom: prev / momRef - 1 };
  }

  // primary symbol (ctx) plus auxiliary refs
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
    if (best == null || r.mom > best.mom) best = { sym: e.sym, mom: r.mom };
  }

  // current holdings
  let held = null;
  for (const e of entries) {
    const p = ctx.pos(e.sym);
    if (p != null && p.position > 0) { held = { sym: e.sym, qty: p.position }; break; }
  }

  if (held != null) {
    const hm = entries.find(e => e.sym === held.sym);
    const r = hm ? rankOf(hm.m) : null;
    const stillBest = best != null && best.sym === held.sym;
    if (!stillBest || r == null) {
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
