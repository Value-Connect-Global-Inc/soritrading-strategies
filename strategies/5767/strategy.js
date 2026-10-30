/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation Top2 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest assets in a bull phase keep leading — relative strength persists for weeks. Instead of betting all cash on ONE leader (which gave 50-60% drawdown), hold the top-2 momentum leaders with equal weight. Diversification across the two strongest should cut single-asset drawdown while keeping most of the rotation return.
 * When it buys and sells: Every bar, rank the symbols by 30-bar momentum (closed bars), keep only those above their 200-bar average. Hold the top-2 with ~47% of cash each; sell a symbol when it leaves the top-2 or drops below its 200-bar average.
 * When it does NOT work: In a broad bear market no symbol is above its 200-bar average, so it stays flat. In choppy sideways markets rank flips churn fees. The #2 leader is often a laggard, so diversification can dilute the winner's gain in a strong one-asset bull.
 */
function onUpdate(ctx) {
  const momN = 30;
  const smaN = 200;
  const topK = 2;

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
    return { mom: prev / momRef - 1, px: px };
  }

  const entries = [{ sym: ctx.sym, m: ctx }];
  const nRefs = (ctx.refs && ctx.refs.length) ? ctx.refs.length : 0;
  for (let i = 0; i < nRefs; i++) {
    const rm = ctx.ref(i);
    const rs = (ctx.syms && ctx.syms[i + 1]) ? ctx.syms[i + 1] : ('ref' + i);
    entries.push({ sym: rs, m: rm });
  }

  // rank all symbols by momentum (uptrend only)
  const ranked = [];
  for (const e of entries) {
    const r = rankOf(e.m);
    if (r == null) continue;
    ranked.push({ sym: e.sym, mom: r.mom, px: r.px });
  }
  ranked.sort((a, b) => b.mom - a.mom);
  const targets = ranked.slice(0, topK); // top-2

  // exits first: sell any held symbol no longer in the top-2 or out of uptrend
  for (const e of entries) {
    const p = ctx.pos(e.sym);
    if (p == null || p.position <= 0) continue;
    const r = rankOf(e.m);
    const inTop = targets.some(t => t.sym === e.sym);
    if (r == null || !inTop) {
      return { side: 'sell', sym: e.sym, qty: p.position, reduceOnly: true };
    }
  }

  // entries: buy targets we are not holding, ~47% of cash each
  const orders = [];
  const perLeg = ctx.cash * 0.47;
  for (const t of targets) {
    const p = ctx.pos(t.sym);
    if (p != null && p.position > 0) continue; // already holding
    const qty = perLeg / t.px;
    orders.push({ side: 'buy', sym: t.sym, qty: qty });
  }
  return orders.length ? orders : null;
}
