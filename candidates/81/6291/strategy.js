/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Trend+Short 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto rallies when the US dollar is weak (liquidity expands) and falls when the dollar
 * strengthens sharply (liquidity tightens). The long side rides BTC's uptrend while the dollar is
 * accommodative; the short side adds a return source in down periods by shorting a CONFIRMED downtrend
 * (fast average below slow average, price below the 200-bar average) while the dollar is strongly strong.
 * A cooldown after every short exit prevents the daily-lag dollar signal from re-entering every bar.
 * When it buys and sells: LONG when the 50-bar average crosses above the 200-bar average (or on a pullback
 * to the fast average inside an uptrend) while the dollar index z-score is not strongly positive. SHORT when
 * the trend is down AND the dollar z-score is above +1, with a 30-bar cooldown after each short exit. It
 * closes the long on a trend break, a 3xATR stop, or the dollar turning restrictive; it closes the short on
 * the dollar weakening or the trend turning up.
 * When it does NOT work: in a sideways range with no trend and a neutral dollar it stays flat (safe but
 * idle). The dollar index is daily data with a lag, so a fast flash crash without a dollar spike is only
 * caught by the hard stop. Fees on both legs reduce net return in choppy markets.
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
  if (!ctx.state) ctx.state = {};
  const st = ctx.state;

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
    return null;
  }

  if (pos < 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry + 3 * atr : price * 1.15;
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 break up' },
      { side: 'buy', price: stopPx, trigger: 'above', note: '3xATR short stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'USD regime exit short',
        conds: [{ label: 'USD z', now: usdShow, op: '<', ref: 0.5, closed: true }] }
    ]);
    if (usdZ != null && usdZ < 0.5) { st.shortCooldown = ctx.i; return { side: 'buy', qty: -pos, reduceOnly: true }; }
    if (ema50_1 > ema200_1) { st.shortCooldown = ctx.i; return { side: 'buy', qty: -pos, reduceOnly: true }; }
    if (prevClose > sma200) { st.shortCooldown = ctx.i; return { side: 'buy', qty: -pos, reduceOnly: true }; }
    if (prevClose >= stopPx) { st.shortCooldown = ctx.i; return { side: 'buy', qty: -pos, reduceOnly: true }; }
    return null;
  }

  // FLAT. Cooldown: after a short closes, wait 30 bars before shorting again so a stale daily
  // dollar signal cannot re-enter every bar and churn the account (the failure of the previous version).
  const cd = (typeof st.shortCooldown === 'number') ? st.shortCooldown : -999999;
  const cooldownOk = ctx.i - cd >= 30;

  const trendUp = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  const canTrend = usdZ == null || usdZ <= 0.5;
  const pullback = ema50_1 > ema200_1 && prevClose > sma200 && prevClose <= ema50_1;
  const canDip = usdZ == null || usdZ <= 0.0;
  // Short only a CONFIRMED downtrend during strong dollar: fast avg below slow avg AND price below SMA200.
  const trendDown = ema50_1 < ema200_1 && prevClose < sma200;
  const canShort = usdZ != null && usdZ > 1.0 && trendDown && cooldownOk;

  if ((trendUp && canTrend) || (pullback && canDip)) {
    const riskBudget = (usdZ == null) ? 0.30 : 0.30 - 0.20 * Math.max(-1, Math.min(1, usdZ));
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * riskBudget) / (3 * atr));
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
        conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.0, closed: true }] },
      { side: 'sell', price: sma200, trigger: 'below', note: 'Short downtrend+USD',
        conds: [{ label: 'EMA50<EMA200', ok: ema50_1 < ema200_1 }, { label: 'USD z', now: usdShow, op: '>', ref: 1.0, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }

  if (canShort) {
    const shortBudget = 0.30;
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * shortBudget) / (3 * atr));
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Short downtrend+USD',
        conds: [{ label: 'EMA50<EMA200', ok: ema50_1 < ema200_1 }, { label: 'USD z', now: usdShow, op: '>', ref: 1.0, closed: true }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] }
    ]);
    return { side: 'sell', qty };
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
      conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] },
    { side: 'buy', price: sma200, trigger: 'above', note: 'Pullback in uptrend',
      conds: [{ label: 'Pullback to EMA50', ok: prevClose <= ema50_1 }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.0, closed: true }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'Short downtrend+USD',
      conds: [{ label: 'EMA50<EMA200', ok: ema50_1 < ema200_1 }, { label: 'USD z', now: usdShow, op: '>', ref: 1.0, closed: true }] }
  ]);
  return null;
}
