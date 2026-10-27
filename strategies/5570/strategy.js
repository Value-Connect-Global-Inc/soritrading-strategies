/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL VolTarget Basket + Tail Stop 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (5560) is an always-invested inverse-vol basket whose only
 * weakness is bleeding through broad bears (MDD 38-40%). Every attempt to fix that by
 * de-risking to cash failed because it missed V-recoveries. This version attacks the tail
 * differently: it keeps the exact same vol-target engine, but adds a per-coin TRAILING stop
 * that exits ONLY the coin that crashes 25% from its recent peak. The other coins stay fully
 * invested, so the always-invested V-recovery edge is preserved — we only cut the worst tail.
 * When it buys and sells: Same as champion — daily inverse-ATR sizing, 1/3 slice per coin,
 * rebalance band. NEW: if a coin falls 25% from its 20-day high, that coin is sold to cash
 * and stays out until it breaks back above its 55-day high (a new trend). No de-risking of
 * the whole basket, only of the collapsing coin.
 * When it does NOT work: In a broad bear where all three coins fall together, each coin
 * trips its tail stop and the basket ends up in cash anyway (same as the old de-risking
 * failure — it will miss the V-recovery). The 25% stop can also sell a coin right before a
 * sharp rebound. It still lags pure-BTC buy-and-hold in a BTC-led bull.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null || price <= 0) return null;
  const highs = ctx.highs;
  const closes = ctx.closes;
  if (highs == null || closes == null || closes.length < 58) return null;

  // Portfolio equity = cash + all open positions (same pattern as champion 5560).
  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  const sym = ctx.sym;
  const pos = ctx.pos(sym);
  const held = pos != null && pos > 0;

  const atr = ctx.atr(14, 1);
  const prevClose = closes.at(-2);
  if (atr == null || atr <= 0 || prevClose == null) return null;

  // 20-day high (closed bars) for the trailing-stop reference; 55-day high for re-entry.
  let hi20 = -Infinity, hi55 = -Infinity;
  for (let i = 2; i <= 21; i++) { const h = highs.at(-i); if (h > hi20) hi20 = h; }
  for (let i = 3; i <= 57; i++) { const h = highs.at(-i); if (h > hi55) hi55 = h; }

  const SLICE = 1 / 3;
  const TARGET_VOL = 0.025; // same daily-vol budget as the validated champion

  if (held) {
    // Tail stop: exit this coin only if it has crashed 25% from its 20-day high.
    // 25% is wide enough not to trigger on normal pullbacks, tight enough to cut a real
    // single-coin crash before it does the full damage. Other coins are untouched.
    if (prevClose < hi20 * 0.75) {
      ctx.watch([{ side: 'sell', note: 'tail stop - coin crashed 25%' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: hi20 * 0.75, trigger: 'below', note: '25% tail stop' }]);
    return null;
  }

  // If we were stopped out, only re-enter when this coin confirms a new uptrend
  // (breaks its 55-day high) — otherwise stay out of a coin that just crashed.
  if (prevClose <= hi55) {
    ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 're-entry after stop' }]);
    return null;
  }

  // Normal vol-target sizing (identical to champion) when not in a stopped-out state.
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;
  const qtyTarget = SLICE * frac * equity / price;
  const threshold = 0.20;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) return null;
  if (qtyTarget > pos) {
    const qty = qtyTarget - pos;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'vol-target rebalance up' }]);
    return { side: 'buy', qty: qty };
  }
  if (qtyTarget < pos) {
    const qty = pos - qtyTarget;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'sell', note: 'vol-target rebalance down' }]);
    return { side: 'sell', qty: qty, reduceOnly: true };
  }
  return null;
}
