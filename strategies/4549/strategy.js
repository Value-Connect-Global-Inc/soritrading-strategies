/*
 * @coinsori-strategy v1
 * name: Donchian 55/30 Vol-Scaled + Breakeven Ratchet (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same validated core as the champion (55-day close high
 * entry, 30-day close low exit, volatility-scaled size) plus ONE new rule: once
 * a trade is up 50%, the hard stop moves from -30% to breakeven. A fast crash
 * can no longer turn a mature winner into a loss — it only gives back the gain
 * since entry. Different mechanism from the failed chandelier: this is a single
 * floor ratchet, not a trailing stop that cuts incremental gains.
 * When it buys and sells: buys on a 55-day close high, vol-scaled size. Sells on
 * a 30-day close low, the 30% hard stop (or breakeven once up 50%).
 * When it does NOT work: in a long sideways market the breakout whipsaws; in a
 * bull-market pullback that dips back to entry after a 50% run, the breakeven
 * stop exits early and forfeits the continuation.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes[n - 2];

  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  let lo30 = Infinity;
  for (let i = n - 2 - 30; i <= n - 3; i++) {
    if (closes[i] < lo30) lo30 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    // Track the highest price since entry (persistent across bars via ctx.state).
    let hi = ctx.state.hi;
    if (hi == null || price > hi) hi = price;
    ctx.state.hi = hi;

    // Breakeven ratchet: once the trade has been up 50%, the hard stop floor
    // rises from -30% to 0%. Reason: at +50% the trade is a mature winner and
    // protecting principal beats letting a crash turn it into a loss. 50% chosen
    // (not 30%) so young winners still have room to breathe through pullbacks.
    const hardStop = ctx.entryPx * 0.70;
    let stopPx = hardStop;
    if (hi >= ctx.entryPx * 1.50) stopPx = ctx.entryPx;

    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (prevClose < lo30) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop (30% / breakeven)' },
               { side: 'sell', price: lo30, trigger: 'below', note: 'exit: 30d low',
                 conds: [{ label: 'close vs 30d low', ok: prevClose >= lo30, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > hi55;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  // Vol-targeting with a HIGH threshold (5%): only crashes / extreme vol cut size,
  // normal melt-ups keep full exposure. Reason: 3% scaled down too much in the
  // 2020-21 bull and forfeited the melt-up; 5% only bites in genuinely extreme regimes.
  const atr = ctx.atr(20, 1);
  let frac = 0.95;
  if (atr != null) {
    const atrPct = atr / prevClose;
    if (atrPct > 0.05) frac = 0.95 * (0.05 / atrPct);
    frac = Math.max(0.10, Math.min(0.95, frac));
  }

  const qty = (ctx.cash * frac) / price;
  if (qty <= 0) return null;
  ctx.state.hi = price; // ratchet anchor = entry price
  return { side: 'buy', qty };
}
