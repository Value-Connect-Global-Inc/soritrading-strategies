/*
 * @coinsori-strategy v1
 * name: BTC Trend Core + VIX Risk Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the plain EMA50/200 trend core is the only thing that has
 * held up on this account (ledger 3312: +40.5% with mdd 25.4, verdict promising).
 * Its weakness is that it stays long through volatility spikes. This adds one
 * genuinely different axis — the CBOE VIX (base.vix) as a z-score risk-off gate:
 * when volatility is far above its own recent mean, new longs are blocked until
 * the spike fades. No extra exits, so no churn.
 * When it buys and sells: buys on a bullish EMA50/200 crossover above SMA200,
 * or re-buys while flat if EMA50>EMA200 and price>SMA400 (trend intact) — but
 * only when VIX z-score is not in a spike. Sells on death cross, 2.5x ATR stop,
 * or a -25% disaster stop.
 * When it does NOT work: VIX is daily and lagged 2 days, so it cannot catch an
 * intraday crash; if VIX spikes are not followed by BTC weakness this gate only
 * adds missed entries. Choppy sideways ranges still whipsaw the core.
 */
function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  const vix = ctx.data("base.vix");
  if (f == null || s == null || fp == null || sp == null || sma200 == null || sma400 == null || atr == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const st = ctx.state;

  // rolling VIX history -> z-score vs its own recent mean (risk-off = spike)
  const hist = st.vixHist || [];
  if (vix != null) { hist.push(vix); if (hist.length > 180) hist.shift(); st.vixHist = hist; }
  let vixZ = 0;
  if (hist.length >= 90) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
    if (sd > 0) vixZ = (vix - mean) / sd;
  }

  if (ctx.position > 0) {
    let stopPx = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : price - 2.5 * atr;
    if (ctx.entryPx != null) stopPx = Math.max(stopPx, ctx.entryPx * 0.75); // -25% hard cap
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'ATR/disaster stop' },
      { side: 'sell', price: s, trigger: 'below', note: 'death cross' }
    ]);
    if (price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (fp > sp && f <= s) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // entry: fresh bullish cross above SMA200, OR re-entry while trend intact above SMA400
  let enter = false;
  if (fp <= sp && f > s && prevClose > sma200) enter = true;
  else if (f > s && prevClose > sma400) enter = true;
  if (enter && vixZ > 1.5) enter = false; // VIX spike = risk-off, no new longs

  ctx.watch([{
    side: 'buy', price: sma400, trigger: 'above', note: 'trend intact re-entry',
    conds: [{ label: 'VIX z-score', now: vixZ, op: '<', ref: 1.5, closed: true }]
  }]);
  if (!enter) return null;

  const riskCash = ctx.cash * 0.02; // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
