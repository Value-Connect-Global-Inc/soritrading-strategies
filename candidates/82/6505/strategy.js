/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The VIX measures equity-market stress, and Bitcoin tends
 * to fall hardest when volatility spikes. Holding BTC only while volatility
 * is calm avoids the worst crash drawdowns while staying in calm bull
 * markets — a different source of safety than a price-trend filter.
 * When it buys and sells: Buy when the VIX is below its own 1-year average
 * (calm markets) AND price is above the 200-day average (uptrend). Sell when
 * the VIX rises well above its average (real stress), price breaks the
 * 200-day average, or price falls 25% from entry (crash backstop). The exit
 * threshold is higher than the entry threshold on purpose (hysteresis) so
 * ordinary pullbacks do not cut a position.
 * When it does NOT work: In a slow quiet bear the VIX stays low, so the gate
 * stays on and it holds into a grinding loss. After a crash it waits for the
 * VIX to calm again, so it misses the very start of a recovery.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const vix = ctx.data('base.vix');
  if (vix == null || !isFinite(vix)) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  // Rolling VIX history — one year of daily values.
  let hist = ctx.state.vixHist;
  if (!Array.isArray(hist)) hist = [];
  hist.push(vix);
  if (hist.length > 365) hist = hist.slice(-365);
  ctx.state.vixHist = hist;

  // Need ~6 months of VIX before the mean/std is meaningful.
  if (hist.length < 180) { ctx.watch([]); return null; }

  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
  const z = sd > 0 ? (vix - mean) / sd : 0;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stop = entry != null ? entry * 0.75 : null; // -25% crash backstop
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend broke' },
      { side: 'sell', price: stop, trigger: 'below', note: 'crash backstop' }
    ]);
    // Exit only on real stress (z>1.0, hysteresis), trend break, or crash stop.
    if (z > 1.0 || prevClose < ema200 || (stop != null && prevClose <= stop)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  const calm = z < 0.5;
  const uptrend = prevClose > ema200;
  ctx.watch([{
    side: 'buy', price: ema200, trigger: 'above', note: 'calm VIX + uptrend',
    conds: [ { label: 'VIX z', now: z, op: '<', ref: 0.5, closed: true } ]
  }]);
  if (calm && uptrend) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
