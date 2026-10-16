/*
 * @coinsori-strategy v1
 * name: CrossMomentum Rotation Top2 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: within a basket of liquid coins the strongest asset in an
 * uptrend tends to keep outperforming (cross-sectional momentum persists).
 * Concentrating on the top-2 by recent return is a different mechanism from the
 * time-series EMA-trend core and captures the same persistence with less lag.
 * When it buys and sells: every bar, rank the 4 coins by their 30-bar (5-day)
 * return; hold the top-2 while they trade above their own 200-period average.
 * Sell a coin when it drops out of the top-2, when the risk-on gate turns off,
 * or when it falls 2.5 ATR below its entry. 12-bar cooldown after an exit.
 * When it does NOT work: in a broad bear market the gate keeps it flat (small
 * loss only); in a choppy market where leadership flips often it churns fees;
 * top-2 concentration means one coin's crash hurts more than a 4-coin basket.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.mom) st.mom = {};
  if (!st.cool) st.cool = {};

  // 5-day return for ranking, from closed bars only so it is identical in
  // backtest, paper and live.
  const N = 30;
  const cur = ctx.closes.at(-2);
  const prev = ctx.closes.at(-2 - N);
  const sma200 = ctx.sma(200, 1);
  if (cur == null || prev == null || prev <= 0 || sma200 == null) return null;
  st.mom[sym] = { i: ctx.i, m: cur / prev - 1, sma: sma200, px: cur };

  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;
  const rows = [];
  for (const s of syms) {
    const e = st.mom[s];
    if (!e) return null;
    if (ctx.i - e.i > 1) return null; // allow 1-bar lag between symbol updates
    rows.push({ sym: s, m: e.m, sma: e.sma, px: e.px });
  }
  if (rows.length < 2) return null;
  rows.sort((a, b) => b.m - a.m);
  const leaders = rows.slice(0, 2);
  // Risk-on gate: only hold when both leaders are above their own 200-SMA,
  // otherwise a broad bear market would ride the least-bad coin down.
  const riskOn = leaders.every(r => r.px > r.sma);
  const isLeader = leaders.some(r => r.sym === sym);

  const pos = ctx.position;
  const atr = ctx.atr(14, 1);
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : ctx.price - 2.5 * atr;
    if (!isLeader || !riskOn) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    if (atr != null && ctx.price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    if (atr != null) ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR' }]);
    return null;
  }

  // Cooldown after an exit so a stop-out is not instantly re-entered lower.
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 12) return null;
  if (!isLeader || !riskOn) return null;
  if (atr == null) return null;
  // 2% risk per held coin; two coins = same total risk budget as the 4-coin core.
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / ctx.price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
