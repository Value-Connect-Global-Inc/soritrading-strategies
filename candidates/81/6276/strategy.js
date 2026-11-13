/*
 * @coinsori-strategy v1
 * name: ETH Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Ethereum is a higher-beta version of Bitcoin — deeper
 * drawdowns but sharper trends. A VIX regime gate keeps the long side out of
 * US-equity risk-off episodes; a strong-trend override lets it in anyway when
 * ETH is breaking out hard on its own (crypto-specific rallies do not show up
 * in US equity VIX). Risk-budget sizing shrinks the position when ETH's own ATR
 * explodes.
 * When it buys and sells: it buys when the 4h close is 3% above its 200-bar
 * average AND (VIX z-score below +1.0 OR the close is more than 15% above the
 * 200-bar average — a strong own-trend breakout). Position = risk 8% of equity
 * over a 5xATR stop distance, capped at full cash. It sells when the close
 * falls 3% below the average, price drops 5xATR below the best high since
 * entry, or VIX z-score jumps above +1.2 (forced risk-off exit).
 * When it does NOT work: in a sideways chop inside the band it stays flat and
 * misses short swings; it lags fast moves because both the 200-bar average and
 * the daily VIX series are slow; and a crypto-only crash with a calm VIX still
 * hits the 5xATR stop.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const vix = ctx.data('base_vix');

  // Rolling VIX z-score from distinct observations (dedupe consecutive repeats).
  const hist = ctx.state.vixHist || [];
  if (vix != null && vix > 0) {
    const last = hist[hist.length - 1];
    if (last == null || Math.abs(last - vix) > 1e-9) {
      hist.push(vix);
      if (hist.length > 120) hist.shift(); // ~6 months of daily obs
      ctx.state.vixHist = hist;
    }
  }
  const n = hist.length;
  let vixZ = null;
  if (n >= 30) {
    const mean = hist.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n) || 1;
    vixZ = (vix - mean) / sd;
  }
  // Unknown vol = assume calm so missing data never blocks entries.
  const calm = vixZ == null || vixZ < 1.0;
  const hotExit = vixZ != null && vixZ > 1.2;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;
    const chand = atrNow != null ? hh - 5 * atrNow : price * 0.9;
    const exitPx = Math.max(sma200 * 0.97, chand);
    if (hotExit) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'VIX panic exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'Trend/chandelier exit' }]);
    if (prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  // Strong own-trend breakout (15% above SMA200) overrides the VIX gate.
  const strongTrend = prevClose > sma200 * 1.15;
  if (prevClose > sma200 * 1.03 && (calm || strongTrend)) {
    ctx.state.hh = price;
    const atrNow = ctx.atr(14, 1);
    // Volatility targeting: risk 8% of equity over the 5xATR stop distance, capped at full cash.
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) {
      qty = Math.min(qty, (ctx.cash * 0.08) / (5 * atrNow));
    }
    ctx.watch([{ side: 'buy', price: sma200 * 1.03, trigger: 'above', note: 'Regime up / strong trend', conds: [{ label: 'VIX z', now: vixZ, op: '<', ref: 1.0 }, { label: 'Strong trend', ok: strongTrend }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200 * 1.03, trigger: 'above', note: 'Regime up / strong trend', conds: [{ label: 'VIX z', now: vixZ, op: '<', ref: 1.0 }, { label: 'Strong trend', ok: strongTrend }] }]);
  return null;
}
