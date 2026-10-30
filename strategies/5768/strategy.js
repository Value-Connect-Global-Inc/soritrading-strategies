/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation FastExit 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest assets in a bull phase keep leading — relative strength persists for weeks. Hold the top-2 momentum leaders. Improvement over 5767: exit a held symbol when it closes below its 50-bar average (medium-trend break) instead of waiting for the 200-bar break — the medium trend turns over much earlier in a crash, so drawdown should shrink while the entry gate (200-bar uptrend) still keeps it out of bear markets.
 * When it buys and sells: Every bar, rank the symbols by 30-bar momentum, keep only those above their 200-bar average. Hold the top-2 with ~47% cash each. Sell a symbol when it leaves the top-2, closes below its 50-bar average, or drops below its 200-bar average.
 * When it does NOT work: The faster 50-bar exit gets shaken out of normal pullbacks inside a continuing bull, so it can miss the next leg up (more whipsaw, more fees). In a broad bear market no symbol is above its 200-bar average, so it stays flat.
 */
function onUpdate(ctx) {
  const momN = 30;
  const smaN = 200;
  const exitN = 50; // faster medium-trend exit
  const topK = 2;

  function trend(m) {
    if (m == null) return null;
    const closes = m.closes;
    if (closes == null || closes.length < smaN + 2) return null;
    const px = closes.at(-1);
    const prev = closes.at(-2);
    const momRef = closes.at(-2 - momN);
    if (momRef == null) return null;
    let sum200 = 0;
    for (let k = 1; k <= smaN; k++) sum200 += closes.at(-1 - k);
    const sma200 = sum200 / smaN;
    if (px <= sma200) return null; // entry gate: must be in a 200-bar uptrend
    let sum50 = 0;
    for (let k = 1; k <= exitN; k++) sum50 += closes.at(-1 - k);
    const sma50 = sum50 / exitN;
    return { mom: prev / momRef - 1, px: px, sma50: sma50 };
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
    ranked.push({ sym: e.sym, mom: r.mom, px: r.px, sma50: r.sma50 });
  }
  ranked.sort((a, b) => b.mom - a.mom);
  const targets = ranked.slice(0, topK);

  // exits: sell any held symbol that left top-2, broke its 50-bar trend, or left the 200-bar uptrend
  for (const e of entries) {
    const p = ctx.pos(e.sym);
    if (p == null || p.position <= 0) continue;
    const r = trend(e.m);
    const inTop = targets.some(t => t.sym === e.sym);
    const broke = (r == null) || (r.px < r.sma50);
    if (!inTop || broke) {
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
