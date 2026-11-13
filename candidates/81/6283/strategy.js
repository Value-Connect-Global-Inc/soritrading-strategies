/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto crashes almost always arrive together with a spike in equity volatility
 * (VIX). This strategy uses the VIX as a risk-on/off gauge measured as a z-score against its own
 * recent mean: when volatility is calm relative to its recent norm, risk assets tend to grind higher;
 * when volatility spikes, drawdowns cluster. The bet: staying long only in calm periods keeps most of
 * the upside while cutting the worst drawdowns.
 * When it buys and sells: it buys BTC when the 4h close is above the 200-bar average (uptrend) and
 * the VIX z-score is below 0.3 (calm). It sells when the close falls below the 200-bar average, the
 * VIX z-score spikes above 1.5 (panic), or price drops 3xATR below entry.
 * When it does NOT work: in a quiet bear market (low VIX but falling prices) it stays long and bleeds;
 * and because it is flat during every panic it misses the V-shaped recoveries right after sharp crashes.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }
  const atr = ctx.atr(14, 1);
  if (atr == null) { ctx.watch([]); return null; }

  // VIX is daily data so the same value repeats across 4h bars; keep a rolling history.
  const vix = ctx.data('base_vix');
  let hist = ctx.state.vixHist || [];
  if (vix != null) {
    hist.push(vix);
    if (hist.length > 120) hist = hist.slice(-120);
    ctx.state.vixHist = hist;
  }
  let vixZ = null;
  if (hist.length >= 30) {
    const use = hist.slice(-90);
    const m = use.reduce((a, b) => a + b, 0) / use.length;
    const sd = Math.sqrt(use.reduce((a, b) => a + (b - m) * (b - m), 0) / use.length);
    if (sd > 0) vixZ = (vix - m) / sd;
  }

  if (pos > 0) {
    const entry = ctx.entryPx;
    // Hard stop 3xATR below entry: a panic can arrive faster than the VIX data (2-day lag) catches it.
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Trend broke' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'VIX panic exit',
        conds: [{ label: 'VIX z-score', now: vixZ, op: '>', ref: 1.5, closed: true }] }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (vixZ != null && vixZ > 1.5) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (vixZ != null && vixZ < 0.3 && prevClose > sma200) {
    // Risk 30% of equity on the 3xATR stop, capped at full cash (no leverage on spot).
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * 0.30) / (3 * atr));
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Calm VIX + uptrend',
      conds: [{ label: 'VIX z-score', now: vixZ, op: '<', ref: 0.3, closed: true }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Calm VIX + uptrend',
    conds: [{ label: 'VIX z-score', now: vixZ, op: '<', ref: 0.3, closed: true }] }]);
  return null;
}
