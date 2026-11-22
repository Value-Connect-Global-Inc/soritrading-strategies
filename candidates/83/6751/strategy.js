/*
 * @coinsori-strategy v1
 * name: BTC Macro Risk-On Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto crashes cluster in risk-off macro periods. When US stock volatility
 * (the VIX) spikes far above its own recent norm, crypto tends to sell off too. This strategy
 * rides the long-term uptrend with full size and only steps aside on a genuine VIX panic, a
 * broken trend line, or a disaster stop.
 * When it buys and sells: Buys when price closes back above the 200-bar trend line (a fresh
 * recovery). Sells when price closes below it, when the VIX is more than 2.5 std dev above its
 * own recent norm (real panic), or on a -25% disaster stop.
 * When it does NOT work: In a slow grinding bear market the VIX stays low, so the panic filter
 * cannot help and it loses with the trend line — just less than holding. A sudden gap crash can
 * hit the disaster stop before the VIX data updates.
 */
function onUpdate(ctx) {
  // ---- macro regime from FRED VIX (2-day lag, no look-ahead) ----
  let vz = 0;
  const vix = ctx.data("base_vix");
  if (vix != null) {
    let hist = ctx.state.vixHist || [];
    const last = hist.length ? hist[hist.length - 1] : null;
    if (!last || last.v !== vix) {
      hist = hist.concat([{ v: vix }]);
      if (hist.length > 120) hist = hist.slice(-120); // ~4 months of daily values
      ctx.state.vixHist = hist;
    }
    if (hist.length >= 60) { // need ~2 months of VIX history for a stable baseline
      const mean = hist.reduce((s, h) => s + h.v, 0) / hist.length;
      const sd = Math.sqrt(hist.reduce((s, h) => s + (h.v - mean) * (h.v - mean), 0) / hist.length) || 1;
      vz = (vix - mean) / sd;
    }
  }

  // ---- trend filter on closed bars (identical in backtest/paper/live) ----
  const sma = ctx.sma(200, 1); // long-term trend line on 4h (~33 days)
  const smaP = ctx.sma(200, 2);
  const closePrev = ctx.closes.at(-2); // last CLOSED bar
  const closePrev2 = ctx.closes.at(-3);
  if (sma == null || smaP == null || closePrev == null || closePrev2 == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    const stopPx = entryPx != null ? entryPx * 0.75 : 0;
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'trend break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '-25% stop' },
      { side: 'sell', price: ctx.price, trigger: 'below', note: 'VIX panic', conds: [{ label: 'VIX z', now: vz, op: '>', ref: 2.5, closed: true }] }
    ]);
    const panic = vz > 2.5; // only a true VIX panic steps the strategy aside
    const trendBreak = closePrev < sma;
    const crash = entryPx != null && ctx.price <= stopPx;
    if (panic || trendBreak || crash) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // entry: fresh recovery — close crosses back above the long trend line (no VIX requirement,
  // so we catch recoveries even while the VIX is still elevated after a crash)
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'trend recovery' }]);
  if (closePrev2 <= smaP && closePrev > sma) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
