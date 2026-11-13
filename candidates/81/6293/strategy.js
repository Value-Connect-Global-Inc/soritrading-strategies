/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto rallies when the US dollar is weak (global liquidity expands) and tends to
 * crash when the dollar strengthens sharply (liquidity tightens). This strategy follows BTC's trend but
 * only takes longs when the broad dollar index is not in a restrictive regime, and it exits when the
 * dollar turns sharply restrictive, so it skips the worst USD-driven drawdowns. It also adds to winning
 * positions when the trend is strong, so parabolic bull runs are captured more fully.
 * When it buys and sells: it buys BTC when the 50-bar average crosses above the 200-bar average while the
 * dollar index z-score is not strongly positive, or when price pulls back to the fast average inside an
 * uptrend while the dollar is accommodative. It adds to the position when price is more than 2xATR above
 * the 200-bar average (strong trend) up to a cap. It sells when the 50-bar average crosses below the
 * 200-bar average, the close falls below the 200-bar average, price drops 3xATR below entry, or the dollar
 * index z-score rises above +1 while holding (macro regime reversal).
 * When it does NOT work: in a long melt-up the dollar filter rarely blocks trades so the strategy is in
 * the market most of the time, but it still misses part of the rise relative to holding because it is not
 * fully invested at every moment. A long-only strategy cannot match a parabolic bull market's buy-and-hold
 * return, and in a slow grinding bear the uptrend filters keep it flat (safe but useless).
 */

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

  const usdZ = dollarZ(ctx);
  const usdShow = usdZ == null ? 0 : usdZ;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: ema200_1, trigger: 'below', note: 'EMA50<EMA200 exit' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'USD regime exit',
        conds: [{ label: 'USD z', now: usdShow, op: '>', ref: 1.0, closed: true }] }
    ]);
    if (usdZ != null && usdZ > 1.0) return { side: 'sell', qty: pos, reduceOnly: true };
    if (ema50_1 < ema200_1) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };

    // PYRAMID: in a strong trend (price >2xATR above SMA200) and a neutral/accommodative dollar,
    // add to the winner up to a total exposure cap. Standard trend-following to capture melt-ups.
    if (usdZ == null || usdZ <= 0.5) {
      const strongTrend = prevClose > sma200 + 2 * atr;
      if (strongTrend) {
        const totalBudget = 0.30 - 0.20 * Math.max(-1, Math.min(1, usdZ == null ? 0 : usdZ));
        const maxQty = (ctx.cash * totalBudget) / (3 * atr);
        const currentValue = pos * price;
        if (currentValue < ctx.cash * 0.9) { // keep total exposure under ~90% of cash
          const addQty = Math.min((ctx.cash * 0.5) / price, maxQty); // add up to ~50% cash worth
          if (addQty > 0) {
            ctx.watch([
              { side: 'sell', price: ema200_1, trigger: 'below', note: 'EMA50<EMA200 exit' },
              { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
              { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
              { side: 'buy', price: sma200, trigger: 'above', note: 'Pyramid strong trend',
                conds: [{ label: 'Price>2ATR', ok: strongTrend }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] }
            ]);
            return { side: 'buy', qty: addQty };
          }
        }
      }
    }
    return null;
  }

  // Trend start: EMA50 crosses above EMA200 on closed bars, price above SMA200, dollar not strongly strengthening.
  const trendUp = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  const canTrend = usdZ == null || usdZ <= 0.5;
  // Pullback in uptrend: price pulled back to/below the fast average but above the 200-bar average, dollar accommodative.
  const pullback = ema50_1 > ema200_1 && prevClose > sma200 && prevClose <= ema50_1;
  const canDip = usdZ == null || usdZ <= 0.0;

  if ((trendUp && canTrend) || (pullback && canDip)) {
    const riskBudget = (usdZ == null) ? 0.30 : 0.30 - 0.20 * Math.max(-1, Math.min(1, usdZ));
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * riskBudget) / (3 * atr));
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
        conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.0, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
      conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] },
    { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
      conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.0, closed: true }] }
  ]);
  return null;
}
