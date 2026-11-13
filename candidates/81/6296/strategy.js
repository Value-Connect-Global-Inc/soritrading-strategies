/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Dual 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto rallies when the US dollar is weak (global liquidity expands) and falls
 * when the dollar strengthens sharply (liquidity tightens). Unlike a long-only strategy, this one
 * trades BOTH directions on the perpetual market: it goes long in an uptrend when the dollar is not
 * strong, and it goes short in a downtrend when the dollar is not weak. That lets it profit in falling
 * periods instead of just sitting flat, which long-only trend strategies cannot do.
 * When it buys and sells: long when the 50-bar average is above the 200-bar average (uptrend) and the
 * dollar z-score is below +0.5, either on a fresh trend start or on a pullback to the fast average;
 * short symmetrically when the 50-bar average is below the 200-bar average (downtrend) and the dollar
 * z-score is above -0.5. It exits when the trend flips, the close crosses the 200-bar average, price
 * moves 3xATR against entry, or the dollar z-score crosses +1 (long) / -1 (short).
 * When it does NOT work: the dollar index is daily and lags a fast crash, so the 3xATR stop is the
 * real backstop. In a choppy sideways market the trend filters whipsaw and fees accumulate. A short
 * against a strong crypto rally (e.g. a squeeze while the dollar is weak) can lose quickly, so shorts
 * are only taken in a confirmed downtrend.
 */

// z-score of the broad USD index vs its own trailing history (liquidity regime detector)
function dollarZ(ctx) {
  if (!ctx.state) ctx.state = {};
  const st = ctx.state;
  let hist = Array.isArray(st.usdHist) ? st.usdHist : [];
  const usd = ctx.data('base_usd_broad');
  if (usd == null) return null;
  if (hist.length === 0 || Math.abs(hist[hist.length - 1] - usd) > 1e-9) {
    hist.push(usd);
    if (hist.length > 90) hist.splice(0, hist.length - 90);
    st.usdHist = hist;
  }
  if (hist.length < 30) return null; // need ~30 daily observations before the regime is meaningful
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

  const dz = dollarZ(ctx);
  const dzShow = dz == null ? 0 : dz;

  // risk budget scales with the dollar regime, same sizing logic as the proven long-only version:
  // accommodative dollar (negative z) -> bigger budget, restrictive -> smaller
  const riskBudget = (dz == null) ? 0.30 : 0.30 - 0.20 * Math.max(-1, Math.min(1, dz));
  const qty = (ctx.cash * riskBudget) / (3 * atr);

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: ema200_1, trigger: 'below', note: 'Trend down exit' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'USD regime exit',
        conds: [{ label: 'USD z', now: dzShow, op: '>', ref: 1.0, closed: true }] }
    ]);
    if (dz != null && dz > 1.0) return { side: 'sell', qty: pos, reduceOnly: true }; // dollar sharply strong = liquidity tightening
    if (ema50_1 < ema200_1) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos < 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry + 3 * atr : price * 1.15;
    ctx.watch([
      { side: 'buy', price: ema200_1, trigger: 'above', note: 'Trend up exit' },
      { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 break' },
      { side: 'buy', price: stopPx, trigger: 'above', note: '3xATR stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'USD regime exit',
        conds: [{ label: 'USD z', now: dzShow, op: '<', ref: -1.0, closed: true }] }
    ]);
    if (dz != null && dz < -1.0) return { side: 'buy', qty: -pos, reduceOnly: true }; // dollar sharply weak = liquidity expansion
    if (ema50_1 > ema200_1) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose > sma200) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose >= stopPx) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // trend start crossovers on closed bars
  const trendUpCross = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  const trendDnCross = ema50_1 < ema200_1 && ema50_2 >= ema200_2 && prevClose < sma200;
  // pullback entries: price returns to the fast average inside a confirmed trend
  const pullbackLong = ema50_1 > ema200_1 && prevClose > sma200 && prevClose <= ema50_1;
  const pullbackShort = ema50_1 < ema200_1 && prevClose < sma200 && prevClose >= ema50_1;
  const canLong = dz == null || dz <= 0.5; // mildly strong dollar still OK to ride a long
  const canShort = dz == null || dz >= -0.5; // mildly weak dollar still OK to ride a short

  if ((trendUpCross || pullbackLong) && canLong) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Long entry',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: dzShow, op: '<=', ref: 0.5, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }
  if ((trendDnCross || pullbackShort) && canShort) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Short entry',
        conds: [{ label: 'EMA50<EMA200', ok: ema50_1 < ema200_1 }, { label: 'USD z', now: dzShow, op: '>=', ref: -0.5, closed: true }] }
    ]);
    return { side: 'sell', qty };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Long entry',
      conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: dzShow, op: '<=', ref: 0.5, closed: true }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'Short entry',
      conds: [{ label: 'EMA50<EMA200', ok: ema50_1 < ema200_1 }, { label: 'USD z', now: dzShow, op: '>=', ref: -0.5, closed: true }] }
  ]);
  return null;
}
