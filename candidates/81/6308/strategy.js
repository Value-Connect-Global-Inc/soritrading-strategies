/*
 * @coinsori-strategy v1
 * name: ETH Yield-Curve Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is a risk asset that suffers when financial conditions tighten. An inverted
 * or sharply flattening US yield curve (10Y minus 2Y) has historically flagged recession risk and
 * risk-off, while a steepening curve signals easing expectations and risk-on. This strategy follows
 * ETH's trend but only takes longs when the curve is not deeply inverted, and it exits when the curve
 * inverts sharply, so it skips the worst credit-driven drawdowns.
 * When it buys and sells: it buys ETH when the 50-bar average crosses above the 200-bar average while
 * the curve z-score is not deeply negative, or when price pulls back to the fast average inside an
 * uptrend while the curve is not inverted. It sells when the 50-bar average crosses below the 200-bar
 * average, the close falls below the 200-bar average, the curve z-score drops below -1.2, or price
 * drops 6xATR below entry (a disaster backstop only).
 * When it does NOT work: in a long melt-up the curve filter rarely blocks trades, so the strategy is in
 * the market most of the time but still misses part of the rise relative to holding (long-only cannot
 * match a parabolic bull). In a slow grinding bear the trend filters keep it flat (safe but useless).
 * The 2-day data lag means the curve signal reacts slowly to sudden stress.
 */

function curveZ(ctx) {
  if (!ctx.state) ctx.state = {};
  const st = ctx.state;
  let hist = Array.isArray(st.curveHist) ? st.curveHist : [];
  const c = ctx.data('base_t10y2y');
  if (c == null) return null;
  if (hist.length === 0 || Math.abs(hist[hist.length - 1] - c) > 1e-9) {
    hist.push(c);
    if (hist.length > 90) hist.splice(0, hist.length - 90);
    st.curveHist = hist;
  }
  if (hist.length < 30) return null; // need ~30 daily observations before the regime is meaningful
  const n = hist.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += hist[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (hist[i] - mean) * (hist[i] - mean);
  const sd = Math.sqrt(v / n);
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

  const cz = curveZ(ctx);
  const czShow = cz == null ? 0 : cz;

  if (pos > 0) {
    const entry = ctx.entryPx;
    // 6xATR (~15%+) disaster backstop: a 3-4 ATR bull correction is normal and should be ridden,
    // not stopped out — the trend and macro breaks are the real exits. Only a genuine crash hits this.
    const stopPx = (entry != null) ? entry - 6 * atr : price * 0.75;
    ctx.watch([
      { side: 'sell', price: ema200_1, trigger: 'below', note: 'EMA50<EMA200 exit' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '6xATR disaster stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'Curve inversion exit',
        conds: [{ label: 'Curve z', now: czShow, op: '<', ref: -1.2, closed: true }] }
    ]);
    if (cz != null && cz < -1.2) return { side: 'sell', qty: pos, reduceOnly: true }; // deep inversion = risk-off
    if (ema50_1 < ema200_1) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Trend start: EMA50 crosses above EMA200 on closed bars, price above SMA200, curve not deeply inverted.
  const trendUp = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  const canTrend = cz == null || cz > -0.5; // -0.5 z = mildly inverted, still OK to ride a trend
  // Pullback in uptrend: price pulled back to/below the fast average but above the 200-bar average, curve not inverted.
  const pullback = ema50_1 > ema200_1 && prevClose > sma200 && prevClose <= ema50_1;
  const canDip = cz == null || cz > -0.2; // dip buys need a non-inverted curve only

  if ((trendUp && canTrend) || (pullback && canDip)) {
    // Risk budget scales with the curve regime: steep (risk-on) curve -> bigger budget, inverted -> smaller.
    const riskBudget = (cz == null) ? 0.25 : 0.25 + 0.15 * Math.max(-1, Math.min(1, cz));
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * riskBudget) / (3 * atr));
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'Curve z', now: czShow, op: '>', ref: -0.5, closed: true }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
        conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'Curve z', now: czShow, op: '>', ref: -0.2, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
      conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'Curve z', now: czShow, op: '>', ref: -0.5, closed: true }] },
    { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
      conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'Curve z', now: czShow, op: '>', ref: -0.2, closed: true }] }
  ]);
  return null;
}
