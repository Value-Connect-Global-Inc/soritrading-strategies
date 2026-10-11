/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum 4-Asset 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto assets do not all move together — each cycle a different
 *   asset leads. Cross-sectional momentum holds the strongest asset and switches only
 *   when a clearly stronger leader emerges, capturing relative strength that
 *   single-symbol trend following misses.
 * When it buys and sells: buys the asset with the highest 60-bar momentum among those
 *   above their 100-bar average. Holds it, sells when it is no longer the clear leader
 *   (momentum gap < 3%) or its trend breaks. Hard ATR stop on every position.
 * When it does NOT work: in a broad crash all assets fall below their trend lines and
 *   it sits in cash (safe but no upside). Rapid leadership flips in a choppy market
 *   cause whipsaw and fees. It is long-only, so a prolonged bear is a flat hold.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.closes.at(-2);
  if (price == null) return null;

  // 60-bar momentum from CLOSED bars — identical in backtest, paper and live.
  const cur = ctx.closes.at(-2);
  const past = ctx.closes.at(-62);
  if (cur == null || past == null || past <= 0) return null;
  const mom = cur / past - 1;

  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) return null;
  const trendOk = price > sma100;

  // share momentum across symbols via the run-wide state; rank only above trend
  if (!ctx.state.mom) ctx.state.mom = {};
  ctx.state.mom[sym] = trendOk ? mom : -Infinity;

  // find the leader and the runner-up (runner-up needed for the entry edge check)
  const momMap = ctx.state.mom;
  let leader = null, best = -Infinity, second = -Infinity;
  for (const s in momMap) {
    const m = momMap[s];
    if (m > best) { second = best; best = m; leader = s; }
    else if (m > second) { second = m; }
  }
  const isLeader = leader === sym;
  const pos = ctx.position;

  if (pos > 0) {
    // hard stop first — the sizing risk must actually exist as a stop
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stopPx = ctx.entryPx - 2.5 * atr;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR hard stop' }]);
    }
    // my trend broke -> exit
    if (!trendOk) return { side: 'sell', qty: pos };
    // replaced by a clearly stronger leader (gap >= 3%) -> exit
    if (!isLeader) {
      const gap = best - momMap[sym];
      if (gap >= 0.03) return { side: 'sell', qty: pos };
    }
    return null;
  }

  // flat: buy only when I am the leader AND my edge is real (>= 3% over runner-up).
  // hysteresis: once holding, we keep the leader until someone is clearly stronger.
  if (!isLeader || best - second < 0.03) return null;

  // strict rotation: one position at a time across the run
  let totalHeld = 0;
  const syms = ctx.syms;
  if (syms) { for (const s of syms) totalHeld += ctx.pos(s); }
  if (totalHeld > 0) return null;

  // risk-based sizing: 2% of cash at risk over a 2.5x ATR stop
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const qty = Math.min((ctx.cash * 0.02) / (2.5 * atr), (ctx.cash / price) * 0.98);
  if (qty <= 0) return null;
  return { side: 'buy', qty: qty };
}
