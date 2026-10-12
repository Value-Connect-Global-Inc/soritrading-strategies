/*
 * @coinsori-strategy v1
 * name: Hybrid OBV-Trend + Keltner-MR BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Combines the two validated BTC edges into one
 * regime-adaptive strategy. In a rising 45-day OBV regime (money flowing in =
 * trending up) it rides the trend like the OBV champion. When OBV is NOT rising
 * but price is still above the 200-day average, it switches to mean-reversion
 * and buys deep flushes to the lower Keltner band like the Keltner champion.
 * This captures bull momentum AND defends in chop/bear, filling the gap where
 * each champion alone is weak.
 * When it buys and sells: TREND mode (45d OBV rising + price>100d avg): buy and
 * hold long until 45d OBV turns down 1.5%. MR mode (OBV flat/falling, price
 * above 200d avg): buy a flush to the lower Keltner band with RSI<40, sell on
 * snap-back to the 20-day average. ATR-scaled size in both modes.
 * When it does NOT work: in a persistent bear market below the 200-day average
 * it stays mostly idle; the MR mode can catch a few falling knives during deep
 * crashes before the trend turns.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma100 == null || sma200 == null || atr == null || ema20 == null || rsi == null || atr <= 0) return null;

  // --- OBV trend signal ---
  const LOOKBACK = 45;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < LOOKBACK + 2) return null;
  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < LOOKBACK + 1) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 1 - LOOKBACK];
  const obvRising = obvNow > obvPast * 1.01;
  const obvFalling = obvNow < obvPast * 0.985;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  // ATR-scaled size (same rule as both champions)
  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  const riskQty = 0.015 * ctx.cash / atr;
  const maxQty = ctx.cash / price * 0.9;

  // TREND mode active?
  const trendMode = obvRising && price > sma100 && volOk;

  // --- watch declaration (display only, no order) ---
  if (pos > 0) {
    // In position: show exit lines (OBV down in trend mode, snap-back in MR mode)
    const watch = [];
    if (obvFalling && cd === 0) {
      watch.push({ side: 'sell', price: price, trigger: 'below', note: 'OBV down', conds: [{ label: 'OBV falling', ok: true }] });
    }
    if (!trendMode && price > ema20 && cd === 0) {
      watch.push({ side: 'sell', price: ema20, trigger: 'below', note: 'MR snap-back', conds: [{ label: 'Price > EMA20', now: price, op: '>', ref: ema20, closed: false }] });
    }
    if (watch.length === 0) {
      watch.push({ side: 'sell', price: ema20, trigger: 'below', note: 'Exit level' });
    }
    ctx.watch(watch);
  } else {
    // No position: show entry lines
    if (cd > 0) {
      ctx.watch([]);
    } else if (trendMode) {
      ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'TREND entry', conds: [{ label: 'OBV rising', ok: true }, { label: 'Price > SMA100', now: price, op: '>', ref: sma100, closed: false }, { label: 'Volume > avg', ok: volOk }] }]);
    } else {
      const lower = ema20 - 2.5 * atr;
      const mrConds = [];
      if (price > sma200) mrConds.push({ label: 'Price > SMA200', now: price, op: '>', ref: sma200, closed: false });
      if (rsi < 40) mrConds.push({ label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true });
      ctx.watch([{ side: 'buy', price: lower, trigger: 'below', note: 'MR flush', conds: mrConds }]);
    }
  }

  if (pos > 0) {
    // In trend mode, exit when OBV turns down. In MR mode, exit on snap-back.
    if (obvFalling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    if (!trendMode && price > ema20 && cd === 0) {
      ctx.state.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (cd > 0) return null;

  // TREND entry
  if (trendMode) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }

  // MR entry: OBV not rising, price above 200d avg, deep flush to lower Keltner band
  const lower = ema20 - 2.5 * atr;
  if (price > sma200 && price <= lower && rsi < 40) {
    ctx.state.cd = 2;
    return { side: 'buy', qty: Math.min(riskQty, maxQty) };
  }
  return null;
}
