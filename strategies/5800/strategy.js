/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT, DOGE/USDT, ADA/USDT, LINK/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Cross-sectional momentum — crypto's strongest assets keep their
 * momentum for weeks, so holding the top-3 by 30-day return and rebalancing weekly
 * captures persistent winners while cutting losers. A different family (momentum vs
 * mean reversion) that is still diversified across 8 majors, unlike single-asset
 * systems that lost to buy-and-hold.
 * When it buys and sells: On each weekly rebalance it holds the 3 assets with the
 * highest positive 30-day return, equal weight. It sells an asset when it drops out of
 * the top-3 or its 30-day return turns negative. A 50% disaster stop exits immediately.
 * When it does NOT work: In a choppy range-bound market, winners reverse to losers
 * within a week and it churns through fees. In a sharp V-reversal it can sell the
 * bottom just before the recovery.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // 30-bar momentum for every symbol, from closed bars only (no look-ahead).
  // Guard every market read: a symbol may not have enough history yet (warm-up) or
  // may be unavailable — skip the whole tick until all 8 have 32 closed bars.
  const mom = {};
  for (const s of ctx.syms) {
    const m = ctx.market(s);
    if (m == null) return null;
    const closes = m.closes;
    if (!Array.isArray(closes) || closes.length < 32) return null;
    const c1 = closes.at(-2);   // last closed bar
    const c30 = closes.at(-31); // 30 bars before it
    if (!Number.isFinite(c1) || !Number.isFinite(c30) || c30 <= 0) return null;
    mom[s] = c1 / c30 - 1;
  }

  const sorted = Object.keys(mom).sort((a, b) => mom[b] - mom[a]);
  const top3 = sorted.slice(0, 3);
  const inTop = top3.includes(sym);
  const isRebalance = ctx.i % 7 === 0; // weekly rebalance on shared bar index

  const pos = ctx.pos(sym);
  const entry = ctx.entryPx;

  if (pos > 0) {
    // Disaster cap only: a 50% drop below entry means the thesis broke, exit now and
    // never wait for the next rebalance. Wide on purpose so winners keep running.
    if (entry != null && Number.isFinite(entry) && entry > 0) {
      ctx.watch([{ side: 'sell', price: entry * 0.5, trigger: 'below', note: '50% disaster stop' }]);
      if (price < entry * 0.5) {
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
    // Hold-to-rebalance: exit only on the weekly rebalance when rank or sign flipped.
    if (isRebalance && (!inTop || mom[sym] <= 0)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: wait for the next weekly rebalance to reconsider the ranking.
  ctx.watch([{ side: 'buy', at: ctx.times.at(-1) + (7 - (ctx.i % 7)) * 86400, note: 'next weekly rebalance' }]);

  if (isRebalance && inTop && mom[sym] > 0) {
    // Equal-weight target: about a quarter of free cash per position, 3 positions max.
    const qty = (ctx.cash / price) * 0.25;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
