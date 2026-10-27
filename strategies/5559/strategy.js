/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL VolTarget Basket 30% Band 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The equal-slice basket (5554) is the validated champion but makes ~180
 * trades per window, most of them small rebalance noise that pays the 0.1% fee twice. This
 * version widens the rebalance band from 20% to 30% so it only trades when the vol-target
 * moves materially — same engine, less fee drag. A robustness tweak, not a new idea.
 * When it buys and sells: Every day each coin is sized by inverse 14-day ATR toward a 2.5%
 * daily-vol budget, capped at a 1/3 slice. Rebalances only when the target moves >30%.
 * When it does NOT work: Same regimes as the champion — broad bears bleed, and it lags
 * buy-and-hold in a BTC-led bull. A wider band also reacts slower to a vol spike.
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

  const SLICE = 1 / 3;
  const TARGET_VOL = 0.025;
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;

  const qtyTarget = SLICE * frac * equity / price;

  const threshold = 0.30; // wider band = fewer small rebalance trades, less fee drag
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) {
    return null;
  }

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
