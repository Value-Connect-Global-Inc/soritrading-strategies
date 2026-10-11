/*
 * @coinsori-strategy v1
 * name: BTC 1D Dual-Mode OBV Trend + Keltner MR
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Two strategies that capture DIFFERENT regimes are combined.
 * OBV volume-flow trend rides accumulation-driven melt-ups, while Keltner
 * mean-reversion buys deep oversold flushes in confirmed bear/chop markets.
 * A rising 200-day average picks the mode: above the 200-day line → OBV trend;
 * clearly below it → Keltner MR. This captures melt-up upside while staying
 * productive in crashes.
 * When it buys and sells: In an uptrend it buys when 45-day OBV is rising with
 * volume confirmation and sells when OBV rolls over. In a confirmed downtrend
 * (price clearly below the 200-day average) it buys an EXTREME flush to the
 * lower Keltner band (EMA20 - 3x ATR) with RSI<30 and sells on the snap-back
 * to the mid band.
 * When it does NOT work: It structurally LAGS straight-line melt-ups because it
 * waits for confirmation, and even the extreme MR can catch a falling knife in
 * a persistent crash. It is a long-only strategy, not a crash profiteer.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || sma200prev == null || ema20 == null || atr == null || rsi == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  // Regime: above the 200-day line = OBV trend mode; clearly below = Keltner MR.
  const uptrendMode = price > sma200;
  const bearMode = price < sma200 * 0.98;

  // Build OBV from close direction and volume.
  const LOOKBACK = 45;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  let obvRising = false;
  let obvFalling = false;
  if (closes && vols && closes.length >= LOOKBACK + 2) {
    let obv = 0;
    const obvSeries = [];
    for (let k = 1; k < closes.length; k++) {
      const c = closes[k], p = closes[k - 1], v = vols[k];
      if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
      if (c > p) obv += v;
      else if (c < p) obv -= v;
      obvSeries.push(obv);
    }
    if (obvSeries.length >= LOOKBACK + 1) {
      const obvNow = obvSeries[obvSeries.length - 1];
      const obvPast = obvSeries[obvSeries.length - 1 - LOOKBACK];
      obvRising = obvNow > obvPast * 1.01;
      obvFalling = obvNow < obvPast * 0.985;
    }
  }
  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  // Deeper band (3x ATR) + RSI<30 = only true capitulation flushes trigger MR.
  const lower = ema20 - 3.0 * atr;

  if (pos > 0) {
    if (uptrendMode) {
      // Uptrend mode: exit when OBV rolls over (money flow leaving).
      ctx.watch([{ side: 'sell', note: 'OBV rollover exit', conds: [{ label: 'OBV falling', ok: obvFalling }] }]);
      if (obvFalling) {
        st.cd = ctx.i + 2;
        return { side: 'sell', qty: pos };
      }
      return null;
    }
    // Bear/chop mode: sell on the snap-back to the mid band.
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', note: 'mid band exit' }]);
    if (price > ema20) {
      st.cd = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (st.cd != null && ctx.i < st.cd) {
    ctx.watch([{ side: 'buy', note: 'cooldown', conds: [{ label: 'cooldown over', ok: ctx.i >= st.cd }] }]);
    return null;
  }

  if (uptrendMode) {
    // Uptrend entry: OBV rising + volume confirmation.
    ctx.watch([{ side: 'buy', note: 'OBV trend entry', conds: [{ label: 'OBV rising', ok: obvRising }, { label: 'Volume > 30d avg', ok: volOk }] }]);
    if (obvRising && volOk) {
      st.cd = null;
      return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
    }
    return null;
  }

  // Bear/chop entry: only an EXTREME capitulation flush, clearly below 200-day.
  ctx.watch([{ side: 'buy', price: lower, trigger: 'below', note: 'Keltner lower capitulation', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'Bear mode', ok: bearMode }] }]);
  if (bearMode && price <= lower && rsi < 30) {
    st.cd = null;
    // ATR-scaled size: risk 1% of equity per trade, capped at 90% of cash.
    const riskEq = 0.01 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = (ctx.cash / price) * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
