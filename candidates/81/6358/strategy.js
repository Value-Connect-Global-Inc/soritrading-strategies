/*
 * @coinsori-strategy v1
 * name: Top-2 Fast Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, relative strength persists for weeks — the strongest assets keep leading while the weakest keep lagging. Instead of betting on one symbol, this strategy holds only the 2 strongest of 4 majors by momentum and re-ranks frequently. It is a different family (cross-asset relative strength) than the single-symbol trend/rates/on-chain ideas already tested. This version rebalances every ~7.5 days instead of 15 — alt leadership in recent years rotates faster than a fortnightly rebalance can follow, so a faster cadence should catch more of the rotation.
 * When it buys and sells: every ~45 bars (7.5 days) it ranks BTC/ETH/SOL/BNB by 200-bar momentum, buys the top 2 — but ONLY if that symbol is also above its own 200-bar average (avoids catching a falling knife) — and sells the rest; a wide 25% stop protects any open position between rebalances.
 * When it does NOT work: if leadership rotates faster than even 7.5 days it still buys the just-topped symbol and holds the falling one; in a broad melt-up where all 4 rise together, concentrating in the top 2 underperforms holding the whole basket. The trend filter keeps it in cash when all 4 are below their averages, so it misses early bottoms. Fees from ~4 rebalances a month eat into small moves.
 */
function onUpdate(ctx) {
  const syms = ctx.syms;
  if (!syms || syms.length < 2) { ctx.watch([]); return null; }

  // Rolling close history per symbol (each symbol appends its own price on its own tick).
  const hist = ctx.state.hist || {};
  const arr = hist[ctx.sym] || [];
  arr.push(ctx.price);
  if (arr.length > 210) arr.shift();
  hist[ctx.sym] = arr;
  ctx.state.hist = hist;

  const t = ctx.times.at(-1);
  const tPrev = ctx.times.at(-2);
  if (t == null || tPrev == null) { ctx.watch([]); return null; }
  const barSec = t - tPrev;
  if (!(barSec > 0)) { ctx.watch([]); return null; }

  // Rebalance every ~7.5 days of 4h bars (45 bars) — faster than the 90-bar draft to follow faster alt rotation.
  const lastReb = ctx.state.lastReb || 0;
  const rebalEvery = 45;
  const nextReb = lastReb + rebalEvery * barSec;

  const pos = ctx.pos(ctx.sym);
  const have = pos && pos.qty ? pos.qty : 0;

  // Wide hard stop between rebalances (25% — avoids 4h-chop whipsaw).
  if (have > 0 && ctx.entryPx != null && ctx.price <= ctx.entryPx * 0.75) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx * 0.75, trigger: 'below', note: 'hard stop' }]);
    return { side: 'sell', qty: have, reduceOnly: true };
  }

  ctx.watch([{ side: 'buy', at: nextReb, note: 'next rotation' }]);

  if (t < nextReb) return null;
  ctx.state.lastReb = t;

  const mom = {};
  const aboveAvg = {};
  for (const s of syms) {
    const h = hist[s];
    if (!h || h.length < 200) return null;
    mom[s] = h[h.length - 1] / h[0] - 1;
    const sum = h.reduce((a, b) => a + b, 0);
    aboveAvg[s] = h[h.length - 1] > sum / h.length; // price above its own 200-bar mean
  }

  // Rank by momentum; a slot is filled only by a symbol that is also above its own average.
  const ranked = syms.slice().sort((a, b) => mom[b] - mom[a]);
  const top = ranked.filter((s) => aboveAvg[s]).slice(0, 2);
  const inTop = top.indexOf(ctx.sym) >= 0;

  if (inTop && have <= 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.45 };
  }
  if (!inTop && have > 0) {
    return { side: 'sell', qty: have, reduceOnly: true };
  }
  return null;
}
