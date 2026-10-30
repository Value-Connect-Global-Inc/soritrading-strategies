/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation CrashStop 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest assets in a bull phase keep leading. Hold the top-2 momentum leaders. Improvement over 5768: add a tight crash stop — exit any held symbol when it closes 25% below its 20-bar highest close. This is tight enough to actually fire during a sharp market-wide drop (the earlier 60-bar/20% chandelier was too wide and never triggered because rank-rotation exited first), giving real crash protection on top of rank rotation.
 * When it buys and sells: Every bar, rank symbols by 30-bar momentum, keep only those above their 200-bar average. Hold the top-2 with ~47% cash each. Sell a symbol when it leaves the top-2, drops below its 200-bar average, or closes 25% below its 20-bar highest close (crash stop).
 * When it does NOT work: The tight 25%/20-bar stop gets shaken out of normal sharp pullbacks inside a continuing bull, missing the next leg up (more whipsaw). In a broad bear market no symbol is above its 200-bar average, so it stays flat.
 */
function onUpdate(ctx) {
  const momN = 30;
  const smaN = 200;
  const hiN = 20;
  const crashPct = 0.25;
  const topK = 2;

  function trend(m) {
    if (m == null) return null;
    const closes = m.closes;
    if (closes == null || closes.length < smaN + 2) return null;
    const px = closes.at(-1);
    const prev = closes.at(-2);
    const momRef = closes.at(-2 - momN);
    if (momRef == null) return null;
    let sum200 = 0, hi = -Infinity;
    for (let k = 1; k <= smaN; k++) sum200 += closes.at(-1 - k);
    for (let k = 0; k < hiN; k++) { const c = closes.at(-1 - k); if (c > hi) hi = c; }
    const sma200 = sum200 / smaN;
    if (px <= sma200) return null;
    return { mom: prev / momRef - 1, px: px, hi: hi };
  }

  const entries = [{ sym: ctx.sym, m: ctx }];
  const nRefs = (ctx.refs && ctx.refs.length) ? ctx.refs.length : 0;
  for (let i = 0; i < nRefs; i++) {
    const rm = ctx.ref(i);
    const rs = (ctx.syms && ctx.syms[i + 1]) ? ctx.syms[i + 1] : ('ref' + i);
    entries.push({ sym: rs, m: rm });
  }

  const ranked = [];
  for (const e of entries) {
    const r = trend(e.m);
    if (r == null) continue;
    ranked.push({ sym: e.sym, mom: r.mom, px: r.px, hi: r.hi });
  }
  ranked.sort((a, b) => b.mom - a.mom);
  const targets = ranked.slice(0, topK);

  for (const e of entries) {
    const p = ctx.pos(e.sym);
    if (p == null || p.position <= 0) continue;
    const r = trend(e.m);
    const inTop = targets.some(t => t.sym === e.sym);
    const crashed = (r != null) && (r.px < r.hi * (1 - crashPct));
    if (!inTop || r == null || crashed) {
      return { side: 'sell', sym: e.sym, qty: p.position, reduceOnly: true };
    }
  }

  const orders = [];
  const perLeg = ctx.cash * 0.47;
  for (const t of targets) {
    const p = ctx.pos(t.sym);
    if (p != null && p.position > 0) continue;
    orders.push({ side: 'buy', sym: t.sym, qty: perLeg / t.px });
  }
  return orders.length ? orders : null;
}
