/*
 * @coinsori-strategy v1
 * name: DXY Gated BTC Trend 4H RE CD
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on 4h during risk-on (weak dollar) regimes; it re-enters whenever the uptrend is intact so it does not miss bull runs, but waits 8 bars after a stop-out to avoid buying the top of a failed rally.
 * When it buys and sells: Buys when flat AND (50 EMA above 200 EMA) AND price above the 400-bar average AND Dollar Index below 104 — and at least 8 bars since the last stop-out. Sells when price falls 8% below the highest close since entry.
 * When it does NOT work: The cooldown can make it miss a fast V-recovery after a stop-out. Below the 400-bar average it never trades, and during a strong-dollar rally (DXY > 104) it stays out and misses the move.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1), emaS = ctx.ema(200, 1);
  const sma400 = ctx.sma(400, 1);
  const price = ctx.closes.at(-2);
  if (emaF == null || emaS == null || sma400 == null || price == null) return null;

  // ---- trailing stop exit (caps loss at 8% of the peak, lets winners run) ----
  if (ctx.position > 0) {
    const hi = ctx.state.hi != null ? Math.max(ctx.state.hi, price) : price;
    ctx.state.hi = hi;
    const stopPx = hi * 0.92;
    if (price <= stopPx) {
      ctx.state.cooldown = ctx.i + 8; // 8 bars = 32 hours on 4h, wait before re-entry
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '8% trailing stop' }]);
    return null;
  }

  // ---- entry only when flat ----
  const dxy = ctx.macro('dxy');
  if (dxy != null && dxy >= 104) return null;

  // Skip re-entry during the cooldown after a stop-out.
  // Reason: momentum right after a stop-out is often still down; buying immediately
  // catches the top of a failed rally, which is what pushed MDD up.
  if (ctx.state.cooldown != null && ctx.i < ctx.state.cooldown) return null;

  const trendUp = emaF > emaS && price > sma400;
  if (trendUp) {
    ctx.state.hi = price;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
