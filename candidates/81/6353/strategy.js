/*
 * @coinsori-strategy v1
 * name: Top-2 Momentum Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, relative strength persists for weeks — the strongest assets keep leading while the weakest keep lagging. Instead of betting on one symbol (long-only misses the point of rotation), this strategy holds only the 2 strongest of 4 majors by 200-bar momentum and re-ranks every ~15 days. It is a different family (cross-asset relative strength) than the single-symbol trend/rates/on-chain ideas already tested.
 * When it buys and sells: every ~90 bars (15 days) it ranks BTC/ETH/SOL/BNB by momentum (price now vs 200 bars ago), buys the top 2 (about 45% of cash each) and sells the rest; a wide 25% stop protects any open position between rebalances (wide enough not to whipsaw on 4h chop).
 * When it does NOT work: in a market where leadership rotates faster than the 15-day rebalance, it buys the just-topped symbol and holds the falling one; in a broad melt-up where all 4 rise together, concentrating in the top 2 underperforms holding the whole basket. Fees from two rebalances a month eat into small moves.
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

  // Rebalance every ~15 days of 4h bars (90 bars).
  const lastReb = ctx.state.lastReb || 0;
  const rebalEvery = 90;
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
  for (const s of syms) {
    const h = hist[s];
    if (!h || h.length < 200) return null;
    mom[s] = h[h.length - 1] / h[0] - 1;
  }

  const ranked = syms.slice().sort((a, b) => mom[b] - mom[a]);
  const inTop = ranked[0] === ctx.sym || ranked[1] === ctx.sym;

  if (inTop && have <= 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.45 };
  }
  if (!inTop && have > 0) {
    return { side: 'sell', qty: have, reduceOnly: true };
  }
  return null;
}
