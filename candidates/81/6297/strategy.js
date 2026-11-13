/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Long-Short 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto rallies when the US dollar is weak (global liquidity expands) and falls when the
 * dollar strengthens sharply (liquidity tightens). A long-only trend strategy earns nothing in strong-dollar
 * downtrends, so this version adds a SHORT side: it holds a short when the dollar is strong and BTC is in a
 * downtrend, capturing the down-move that the long-only version sat through. This is the macro-regime family
 * extended from long-only to directional long-short.
 * When it buys and sells: it goes LONG on a fresh 50/200 up-cross or on a pullback to the fast average inside
 * an uptrend while the dollar is weak; it goes SHORT on a fresh 50/200 down-cross or on a rally to the fast
 * average inside a downtrend while the dollar is strong. It exits a long when the trend flips down, the close
 * breaks the 200-bar average, price drops 3xATR below entry, or the dollar turns strongly strong. A short
 * exits on the mirror image. Both sides keep the position sized to a fixed risk fraction.
 * When it does NOT work: in a range-bound market with no clear trend the 50/200 signals whipsaw and pay fees
 * on both sides. The dollar index is daily and lags a fast BTC move, so a sharp crash can outrun the regime
 * signal — the 3xATR stop is the backstop. Funding on the perpetual must be paid on the short side.
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

  const trendUp = ema50_1 > ema200_1;
  const trendDn = ema50_1 < ema200_1;

  // Position sizing: risk a fixed fraction of equity per trade via the ATR stop distance.
  const riskFrac = 0.02; // 2% of equity risked per trade
  const qtyLong = Math.min(ctx.cash / price * 0.99, (ctx.cash * riskFrac) / (3 * atr));
  const qtyShort = Math.min(ctx.cash / price * 0.99, (ctx.cash * riskFrac) / (3 * atr));

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: ema200_1, trigger: 'below', note: 'Trend flip down' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'USD strong exit',
        conds: [{ label: 'USD z', now: usdShow, op: '>', ref: 1.0, closed: true }] }
    ]);
    if (usdZ != null && usdZ > 1.0) return { side: 'sell', qty: pos, reduceOnly: true }; // dollar sharply strong = flip to bearish
    if (trendDn) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos < 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry + 3 * atr : price * 1.15;
    ctx.watch([
      { side: 'buy', price: ema200_1, trigger: 'above', note: 'Trend flip up' },
      { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 break' },
      { side: 'buy', price: stopPx, trigger: 'above', note: '3xATR stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'USD weak exit',
        conds: [{ label: 'USD z', now: usdShow, op: '<', ref: -0.5, closed: true }] }
    ]);
    if (usdZ != null && usdZ < -0.5) return { side: 'buy', qty: -pos, reduceOnly: true }; // dollar weak = flip to bullish
    if (trendUp) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose > sma200) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose >= stopPx) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // Flat: entries on fresh crosses AND pullbacks, gated by the dollar regime.
  const freshUp = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  const freshDn = ema50_1 < ema200_1 && ema50_2 >= ema200_2 && prevClose < sma200;
  // Pullback in an uptrend: price pulled back to/below the fast average but stays above the 200-bar average.
  const longDip = trendUp && prevClose > sma200 && prevClose <= ema50_1;
  // Rally in a downtrend: price rallied up to/above the fast average but stays below the 200-bar average.
  const shortRally = trendDn && prevClose < sma200 && prevClose >= ema50_1;
  // Long needs a weak-ish dollar; short needs a strong dollar (the whole macro thesis).
  const canLong = usdZ == null || usdZ <= 0.5;
  const canShort = usdZ == null || usdZ > 0.5;

  if (freshUp && canLong) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Long trend start',
        conds: [{ label: 'EMA50>EMA200', ok: true }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] }
    ]);
    return { side: 'buy', qty: qtyLong };
  }
  if (freshDn && canShort) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Short trend start',
        conds: [{ label: 'EMA50<EMA200', ok: true }, { label: 'USD z', now: usdShow, op: '>', ref: 0.5, closed: true }] }
    ]);
    return { side: 'sell', qty: qtyShort };
  }
  if (longDip && canLong) {
    ctx.watch([
      { side: 'buy', price: ema50_1, trigger: 'below', note: 'Long pullback',
        conds: [{ label: 'Uptrend', ok: trendUp }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] }
    ]);
    return { side: 'buy', qty: qtyLong };
  }
  if (shortRally && canShort) {
    ctx.watch([
      { side: 'sell', price: ema50_1, trigger: 'above', note: 'Short rally',
        conds: [{ label: 'Downtrend', ok: trendDn }, { label: 'USD z', now: usdShow, op: '>', ref: 0.5, closed: true }] }
    ]);
    return { side: 'sell', qty: qtyShort };
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Long trend start',
      conds: [{ label: 'EMA50>EMA200', ok: trendUp }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'Short trend start',
      conds: [{ label: 'EMA50<EMA200', ok: trendDn }, { label: 'USD z', now: usdShow, op: '>', ref: 0.5, closed: true }] },
    { side: 'buy', price: ema50_1, trigger: 'below', note: 'Long pullback',
      conds: [{ label: 'Uptrend', ok: trendUp }, { label: 'USD z', now: usdShow, op: '<=', ref: 0.5, closed: true }] },
    { side: 'sell', price: ema50_1, trigger: 'above', note: 'Short rally',
      conds: [{ label: 'Downtrend', ok: trendDn }, { label: 'USD z', now: usdShow, op: '>', ref: 0.5, closed: true }] }
  ]);
  return null;
}
