/*
 * @coinsori-strategy v1
 * name: ETH 4H Trend + VIX Z-Score Gate
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A slow 4h trend ride on ETH with a macro fear-gauge overlay. The US
 * equity VIX measures global risk appetite; when it spikes far above its own recent
 * history, crypto tends to sell off even if its own chart still looks fine. ETH is
 * higher-beta than BTC, so the fear gate should cut its crashes harder while the trend
 * filter keeps the bull upside. Same logic that validated on BTC 4H, applied to ETH.
 * When it buys and sells: Buy when the 4h trend is up (EMA50 above EMA200 and price above
 * EMA50) and VIX is not far above its recent mean (z-score < 1). Sell when the trend
 * breaks, or VIX spikes (z-score > 2), or price falls -25% from entry (tail insurance).
 * When it does NOT work: VIX is a 2-day-lagged daily number, so it cannot help a fast
 * crypto-only crash that does not move equities. In a long calm sideways market the trend
 * filter whipsaws and pays fees. It lags a straight-line melt-up that never pulls back.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  // VIX: CBOE fear gauge, 2-day lag so no look-ahead. Build a rolling history in state
  // (dedup consecutive daily readings) to get a z-score vs its own recent mean.
  const vix = ctx.data('base.vix');
  if (vix == null) { ctx.watch([]); return null; }
  const hist = ctx.state.vixHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== vix) {
    hist.push(vix);
    if (hist.length > 90) hist.shift(); // ~90 days of daily VIX
    ctx.state.vixHist = hist;
  }
  let vixZ = 0;
  if (hist.length >= 20) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length) || 1;
    vixZ = (vix - mean) / sd;
  }

  const trendUp = ema50 > ema200 && prevClose > ema50;

  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null; // -25% disaster stop
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'VIX panic', conds: [{ label: 'VIX z>2', ok: vixZ > 2 }] },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (vixZ > 2) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (trendUp && vixZ < 1) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up, calm VIX', conds: [{ label: 'VIX z<1', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up', conds: [{ label: 'VIX z<1', ok: vixZ < 1 }] }]);
  return null;
}
