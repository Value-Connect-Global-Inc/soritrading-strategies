/*
 * @coinsori-strategy v1
 * name: Macro-Regime Overlay on VolTarget Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated 3-coin inverse-vol basket (5560) is always invested and
 * therefore bleeds through broad crypto bears where all coins fall together. This version
 * adds a macro-regime overlay that halves the vol budget only when the US yield curve is
 * deeply inverted (recession signal) OR VIX is very high — it stays fully invested the rest
 * of the time so it keeps the V-recovery edge that made the champion work.
 * When it buys and sells: same daily inverse-ATR sizing and 20% rebalance band as the
 * champion, but in a risk-off macro regime the target position size is halved (never zero —
 * a 5% floor keeps it minimally invested).
 * When it does NOT work: the overlay fires late or not at all in a fast crash (macro data
 * has a 2-day lag and VIX spikes can be sudden), and it still loses in a crypto bear if the
 * macro signal stays quiet. If the regime signal whipsaws, the extra rebalancing adds fees
 * without protection. It also underperforms the champion in a pure bull.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  // Macro regime: de-risk only when the signal is genuinely bad (not a normal dip),
  // so the always-invested edge survives most of the time.
  const vix = ctx.data("base_vix");     // CBOE Volatility Index
  const curve = ctx.data("base_t10y2y"); // 10Y minus 2Y spread, negative = inverted
  let scale = 1.0;
  if (vix != null && vix > 28) scale = 0.5;          // VIX > 28 = panic regime
  if (curve != null && curve < -0.3) scale = 0.5;    // deeply inverted curve = recession signal

  const sym = ctx.sym;

  // Total portfolio equity = liquid cash + market value of all open positions.
  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  const pos = ctx.pos(sym);
  const SLICE = 1 / 3;      // 3 coins, equal notional share
  const TARGET_VOL = 0.025; // same daily-vol budget as the champion 5560
  const realizedVol = atr / price;
  let frac = (TARGET_VOL * scale) / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05; // stay minimally invested even in risk-off

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
