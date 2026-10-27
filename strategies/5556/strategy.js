/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Trend-Gated VolTarget Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The equal-slice basket (5554) is validated but bleeds in broad bears
 * where all three coins fall together. This version keeps the same inverse-ATR vol-target
 * engine but halves the notional slice of any coin trading BELOW its 200-day average — a
 * level-based regime filter that de-risks laggards in a downtrend without chasing the
 * hottest coin (the failure mode of the momentum tilt).
 * When it buys and sells: Every day each coin is sized by inverse 14-day ATR toward a 2.5%
 * daily-vol budget. Coins above their 200-day average get the full 1/3 slice; coins below it
 * get half that slice. Rebalances only when the target moves more than 20%.
 * When it does NOT work: The 200-day filter is slow — it keeps a full slice during the early
 * part of a fresh bear before price crosses below the average, and it misses the first leg of
 * a V-recovery after a deep crash. In a choppy range around the 200-day line it flips slices
 * back and forth, adding churn.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || price == null || price <= 0 || sma200 == null) return null;

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

  // Trend gate: half the notional slice when below the 200-day average (downtrend regime).
  // A coin above it keeps the full 1/3 share. Level-based, not return-chasing.
  let slice = 1 / 3;
  if (price < sma200) slice = slice / 2;

  const TARGET_VOL = 0.025;
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;

  const qtyTarget = slice * frac * equity / price;

  const threshold = 0.20;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) {
    return null;
  }

  if (qtyTarget > pos) {
    const qty = qtyTarget - pos;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'trend-gated vol-target rebalance up' }]);
    return { side: 'buy', qty: qty };
  }
  if (qtyTarget < pos) {
    const qty = pos - qtyTarget;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'sell', note: 'trend-gated vol-target rebalance down' }]);
    return { side: 'sell', qty: qty, reduceOnly: true };
  }
  return null;
}
