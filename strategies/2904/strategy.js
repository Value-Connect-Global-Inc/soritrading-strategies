/*
 * @coinsori-strategy v1
 * name: Dual-Mode OBV+Keltner Hybrid (validated champion)
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Combines two validated champions from different families into
 * one capital-allocation strategy. In a confirmed uptrend (price above the 200-day
 * average AND 45-day OBV money-flow rising) it runs the OBV momentum trend capture
 * that rides melt-ups. In a downtrend or sideways regime it switches to the Keltner
 * mean-reversion mode that buys deep flushes to the lower band and sells the snap-back.
 * The two modes never trade against each other because they operate in opposite regimes.
 * When it buys and sells: UPTREND mode buys when OBV is rising + price>200SMA + volume
 * confirms, sells when OBV turns down. DOWNTREND mode buys a flush to the lower Keltner
 * band (EMA20 - 2.5x ATR) with RSI<40 while price>200SMA, sells on snap-back to EMA20.
 * When it does NOT work: in a long flat chop near the 200-day average the regime flips
 * repeatedly and can whipsaw; it never catches a melt-up while in defensive mode, and
 * it cannot beat buy-and-hold in a relentless straight-line bull.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || sma200 == null || rsi == null || atr <= 0) return null;

  const st = ctx.state;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  const LOOKBACK = 45;
  if (!closes || !vols || closes.length < LOOKBACK + 2) return null;

  // OBV money-flow trend (same as the validated OBV champion).
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

  // Regime: uptrend = price above 200-day average AND OBV money-flow rising.
  const uptrend = price > sma200 && obvRising;

  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);

  const lower = ema20 - 2.5 * atr;

  // Declare what this tick is waiting for (display only).
  const watch = [];
  if (pos > 0) {
    if (uptrend) {
      watch.push({ side: 'sell', note: 'OBV turn down', conds: [
        { label: 'OBV(45) falling', ok: obvFalling },
        { label: 'cooldown', ok: cd === 0 }
      ]});
    } else {
      watch.push({ side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' });
    }
  } else {
    if (uptrend) {
      watch.push({ side: 'buy', note: 'OBV momentum entry', conds: [
        { label: 'close > 200SMA', ok: price > sma200 },
        { label: 'OBV(45) rising', ok: obvRising },
        { label: 'volume > avgVol(30)', ok: volOk },
        { label: 'cooldown', ok: cd === 0 }
      ]});
    } else {
      const cooldownOk = !(st.cooldown != null && ctx.i < st.cooldown);
      watch.push({ side: 'buy', price: lower, trigger: 'below', note: 'Keltner lower flush', conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'close > 200SMA', ok: price > sma200 },
        { label: 'cooldown', ok: cooldownOk }
      ]});
    }
  }
  ctx.watch(watch);

  // ---- UPTREND mode: OBV momentum trend capture ----
  if (uptrend) {
    st.mode = 'trend';
    if (pos > 0) {
      if (obvFalling && cd === 0) {
        ctx.state.cd = 5;
        return { side: 'sell', qty: pos };
      }
      return null;
    }
    if (volOk && cd === 0) {
      ctx.state.cd = 5;
      const qty = ctx.cash / price * 0.95 * sizeFrac;
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  // ---- DOWNTREND/CHOP mode: Keltner mean-reversion flush-buying ----
  st.mode = 'mr';
  if (pos > 0) {
    if (price > ema20) {
      st.cooldown = ctx.i + 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }
  if (st.cooldown != null && ctx.i < st.cooldown) return null;
  if (price > sma200 && price <= lower && rsi < 40) {
    st.cooldown = null;
    // ATR-scaled size: risk 1.5% of equity per trade, in coin units.
    const riskEq = 0.015 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = ctx.cash / price * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
