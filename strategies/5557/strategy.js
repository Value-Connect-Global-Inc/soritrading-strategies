/*
 * @coinsori-strategy v1
 * name: 5-Coin VolTarget Defensive Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 3-coin basket (5554) is the validated winner — always invested,
 * inverse-ATR sized, equal slices. This version widens the same proven engine to five coins
 * (BTC, ETH, SOL, XRP, BNB), each capped at one fifth of the account. More legs = a single
 * coin's crash hurts even less, and XRP/BNB are less correlated with BTC than SOL is.
 * When it buys and sells: Every day each coin is sized by inverse 14-day ATR toward a 2.5%
 * daily-vol budget, capped at a 1/5 notional share. Rebalances only when the target moves
 * more than 20%. Never fully exits any coin.
 * When it does NOT work: In a broad bear all five coins fall together and the basket still
 * bleeds. More legs dilute the strongest coin's upside further, so it lags buy-and-hold of
 * the best single coin even more than the 3-coin version.
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

  const N = 5;               // 5 coins, equal notional share of the account
  const SLICE = 1 / N;
  const TARGET_VOL = 0.025;  // same daily-vol budget as the validated 3-coin version
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;

  const qtyTarget = SLICE * frac * equity / price;

  const threshold = 0.20;
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
