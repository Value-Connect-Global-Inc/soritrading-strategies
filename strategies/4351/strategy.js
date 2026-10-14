/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum Rotation 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto, the coin with the strongest relative momentum
 *   tends to keep outperforming for weeks. Instead of time-series breakouts on
 *   each coin (Donchian), this picks the single strongest coin of the five
 *   right now and holds it — a cross-sectional rotation, a different axis.
 * When it buys and sells: every bar, rank the five coins by price vs their own
 *   90-day average (relative strength). Hold the #1 coin. Sell when it loses
 *   the #1 rank, or on a 2.5x ATR hard stop.
 * When it does NOT work: in a broad coordinated crash all five coins fall and
 *   the leader is just the least-bad — rotation loses like everyone else. In a
 *   flat market it churns between coins and pays fees for no gain. It is fully
 *   invested, so it has no cash cushion in drawdowns.
 */
const hist = {}; // sym -> array of closes (module-level, shared across the run)

function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // Record this symbol's close for cross-sectional ranking.
  if (!hist[sym]) hist[sym] = [];
  hist[sym].push(price);

  // Rank all symbols by price vs their own trailing 90-bar average.
  let leader = null, bestM = -Infinity;
  for (const s of ctx.syms) {
    const h = hist[s];
    if (!h || h.length < 100) continue; // need enough history
    const n = h.length;
    const px = h[n - 1];
    const win = Math.min(90, n - 1);
    let sum = 0;
    for (let k = n - win; k < n; k++) sum += h[k];
    const avg = sum / win;
    const mom = px / avg - 1;
    if (mom > bestM) { bestM = mom; leader = s; }
  }
  if (leader == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: price, trigger: 'below', note: 'lost #1 rank' }]);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (leader !== sym) return { side: 'sell', qty: pos }; // rotation out
    return null;
  }

  if (leader !== sym) return null; // only the leader buys

  const hh = ctx.high(55, 2);
  if (hh == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'leader confirmation',
               conds: [{ label: 'top rank by 90d RS', ok: true, closed: true }] }]);
  if (prevClose <= hh) return null; // wait for a fresh 55-bar high close

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.9;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
