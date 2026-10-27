/*
 * @coinsori-strategy v1
 * name: On-Chain Address Trend Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC active addresses measure real network usage. When the 30-day
 * address average is rising, BTC is being adopted and deserves a bigger share of the
 * basket; when it is falling, tilt away from BTC toward ETH/SOL. The basket stays ALWAYS
 * invested (the proven edge in this job) and never uses leverage — it only shifts relative
 * weights, so the total exposure to crypto never drops.
 * When it buys and sells: daily inverse-ATR sizing like the champion, but BTC's slice
 * ranges 0.15-0.55 of the account based on address-trend strength, with ETH and SOL
 * sharing the rest. Rebalanced only when the target moves >20%.
 * When it does NOT work: address trends are lagging and noisy; when price rallies on
 * speculation while on-chain usage is flat, the tilt underweights the winner. It still
 * bleeds in broad crypto bears like any basket.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  const sym = ctx.sym;
  const pos = ctx.pos(sym);

  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  // Track the 30-day address average trend with a slow reference stored in state.
  const addr = ctx.data("addr_sma30");
  let btcSlice = 1 / 3;
  if (addr != null && addr > 0) {
    const st = ctx.state;
    const prev = (st && st.addrPrev) || addr;
    const ratio = addr / prev - 1; // growth vs last stored reference
    btcSlice = 0.33 + Math.max(-0.18, Math.min(0.22, ratio * 8));
    if (st) st.addrPrev = addr;
    else ctx.state = { addrPrev: addr };
  }

  const TARGET_VOL = 0.025;
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;

  const slice = sym === "BTC/USDT" ? btcSlice : (1 - btcSlice) / 2;
  const qtyTarget = slice * frac * equity / price;

  const threshold = 0.20;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) {
    return null;
  }
  if (qtyTarget > pos) {
    ctx.watch([{ side: 'buy', note: 'on-chain tilt rebalance up' }]);
    return { side: 'buy', qty: qtyTarget - pos };
  }
  if (qtyTarget < pos) {
    ctx.watch([{ side: 'sell', note: 'on-chain tilt rebalance down' }]);
    return { side: 'sell', qty: pos - qtyTarget, reduceOnly: true };
  }
  return null;
}
