/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset: when the VIX (US stock-market fear gauge) spikes, risk
 * appetite collapses and crypto usually falls with it; when the VIX is calm, risk-on flows support
 * crypto. This strategy rides BTC's trend but only takes longs when the VIX is not in a fear spike,
 * and it exits when the VIX jumps into a fear regime, so it skips the worst volatility-driven drawdowns.
 * When it buys and sells: it buys BTC when the 50-bar average crosses above the 200-bar average while
 * the VIX z-score is not strongly elevated, or when price pulls back to the fast average inside an
 * uptrend while the VIX is calm. It sells when the 50-bar average crosses below the 200-bar average,
 * the close falls below the 200-bar average, price drops 3xATR below entry, or the VIX z-score jumps
 * above +1 while holding (fear spike = risk-off).
 * When it does NOT work: the VIX is a daily, 2-day-lagged series so it cannot react to a fast intraday
 * crash — the 3xATR stop is the real backstop. In a long melt-up the VIX filter rarely blocks, so the
 * strategy is in the market most of the time but still misses part of the rise versus holding (the
 * structural limit of any long-only trend strategy). In a slow grinding bear the trend filters keep it
 * flat (safe but useless).
 */

// z-score of the VIX vs its own trailing history (fear regime detector)
function vixZ(ctx) {
  if (!ctx.state) ctx.state = {};
  const st = ctx.state;
  let hist = Array.isArray(st.vixHist) ? st.vixHist : [];
  const v = ctx.data('base_vix');
  if (v == null) return null;
  if (hist.length === 0 || Math.abs(hist[hist.length - 1] - v) > 1e-9) {
    hist.push(v);
    if (hist.length > 90) hist.splice(0, hist.length - 90);
    st.vixHist = hist;
  }
  if (hist.length < 30) return null; // need ~30 daily observations before the fear regime is meaningful
  const n = hist.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += hist[i];
  mean /= n;
  let sd = 0;
  for (let i = 0; i < n; i++) sd += (hist[i] - mean) * (hist[i] - mean);
  sd = Math.sqrt(sd / n);
  if (sd < 1e-9) return 0;
  return (hist[n - 1] - mean) / sd;
}

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const ema50_1 = ctx.ema(50, 1);
  const ema200_1 = ctx.ema(200, 1);
  const ema50_2 = ctx.ema(50, 2);
  const ema200_2 = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50_1 == null || ema200_1 == null || ema50_2 == null || ema200_2 == null || sma200 == null || atr == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const vz = vixZ(ctx);
  const vzShow = vz == null ? 0 : vz;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: ema200_1, trigger: 'below', note: 'EMA50<EMA200 exit' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'VIX fear exit',
        conds: [{ label: 'VIX z', now: vzShow, op: '>', ref: 1.0, closed: true }] }
    ]);
    if (vz != null && vz > 1.0) return { side: 'sell', qty: pos, reduceOnly: true }; // VIX fear spike = risk-off
    if (ema50_1 < ema200_1) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const trendUp = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  const canTrend = vz == null || vz <= 0.5; // +0.5 z = mildly fearful, still OK to ride a trend
  const pullback = ema50_1 > ema200_1 && prevClose > sma200 && prevClose <= ema50_1;
  const canDip = vz == null || vz <= 0.0; // dip buys need a calm VIX only

  if ((trendUp && canTrend) || (pullback && canDip)) {
    // risk budget scales with fear: calm VIX (negative z) -> bigger budget, fearful -> smaller
    const riskBudget = (vz == null) ? 0.30 : 0.30 - 0.20 * Math.max(-1, Math.min(1, vz));
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * riskBudget) / (3 * atr));
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'VIX z', now: vzShow, op: '<=', ref: 0.5, closed: true }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
        conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'VIX z', now: vzShow, op: '<=', ref: 0.0, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
      conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'VIX z', now: vzShow, op: '<=', ref: 0.5, closed: true }] },
    { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
      conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'VIX z', now: vzShow, op: '<=', ref: 0.0, closed: true }] }
  ]);
  return null;
}
