/*
 * @coinsori-strategy v1
 * name: CrossMomentum Rotation Top1 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: within a basket of liquid coins the strongest asset in an
 * uptrend tends to keep outperforming (cross-sectional momentum persists).
 * Concentrating on the single top asset by 15-day return is a different
 * mechanism from the time-series EMA-trend core. v1 (top-2, 5-day lookback)
 * churned 700+ trades on 4h bars because leadership flipped every few bars;
 * this version slows the signal (90-bar lookback), holds only the top-1, and
 * lengthens the cooldown so the ranking cannot flip-flop.
 * When it buys and sells: every bar, rank the 4 coins by their 90-bar (15-day)
 * return; hold the leader while it trades above its own 200-period average.
 * Sell when it loses the top rank, when the risk-on gate turns off, or when it
 * falls 2.5 ATR below its entry. 24-bar cooldown after an exit.
 * When it does NOT work: in a broad bear market the gate keeps it flat (small
 * loss only); in a choppy market where leadership still flips it churns fees;
 * a single held coin means one coin's crash hurts the whole account.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.mom) st.mom = {};
  if (!st.cool) st.cool = {};

  // 15-day return for ranking, closed bars only (identical across modes).
  const N = 90;
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
  const leader = rows[0];
  // Risk-on gate: only hold the leader while it is above its own 200-SMA,
  // otherwise a broad bear market would ride the least-bad coin down.
  const riskOn = leader.px > leader.sma;
  const isLeader = leader.sym === sym;

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
  if (lastExit != null && ctx.i - lastExit < 24) return null;
  if (!isLeader || !riskOn) return null;
  if (atr == null) return null;
  // 2% risk on the single held coin — one position, so keep the budget modest.
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / ctx.price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
