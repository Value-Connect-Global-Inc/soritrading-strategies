/*
 * @coinsori-strategy v1
 * name: SOL 4H Trend + USD Strength Gate
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The USD-strength macro gate (broad US Dollar index z-score) validated
 * on BTC 4H, applied UNCHANGED to SOL, the highest-beta major alt. A strong dollar drains
 * global liquidity and is a known headwind for dollar-priced risk assets; SOL is the most
 * sensitive to that liquidity. Thresholds and shape are reused from the BTC version, so
 * every window here is out-of-sample (no fitting at all).
 * When it buys and sells: Buy when the 4h trend is up (EMA50 above EMA200 and price above
 * EMA50) and the dollar is not unusually strong (z-score vs its own ~1y history < 1). Sell
 * when the trend breaks, the dollar spikes (z-score > 2), or price falls -25% from entry.
 * When it does NOT work: USD is a slow 10-day-lagged daily number, so it reacts late to a
 * fast crypto-only crash that does not move the dollar, and it cannot help a melt-up that
 * never pulls back. In a calm sideways market the trend filter whipsaws and pays fees.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const usd = ctx.data('base.usd_broad');
  if (usd == null) { ctx.watch([]); return null; }
  const hist = ctx.state.usdHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== usd) {
    hist.push(usd);
    if (hist.length > 250) hist.shift();
    ctx.state.usdHist = hist;
  }
  let usdZ = 0;
  if (hist.length >= 60) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length) || 1;
    usdZ = (usd - mean) / sd;
  }
  const trendUp = ema50 > ema200 && prevClose > ema50;
  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'USD spike', conds: [{ label: 'USD z>2', ok: usdZ > 2 }] },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (usdZ > 2) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (trendUp && usdZ < 1) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up, weak USD', conds: [{ label: 'USD z<1', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up', conds: [{ label: 'USD z<1', ok: usdZ < 1 }] }]);
  return null;
}
