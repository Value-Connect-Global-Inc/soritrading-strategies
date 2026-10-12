/*
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 * @coinsori-strategy v1
 * name: OBV Relaxed Gate + ATR Trail 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV relaxed-gate trend champion is consistent but carries
 * high drawdown (~30-50%) because it only exits when OBV turns down, giving back
 * large gains in sharp V-reversals. Adding a WIDE ATR trailing stop below the
 * highest close since entry locks in gains on violent reversals while staying wide
 * enough to not fire on normal pullbacks. This is a different exit lever than the
 * trend-slope filters (which were mixed) — it targets the specific high-MDD weakness.
 * When it buys and sells: buys when 30-day OBV is rising, price above the 100-day
 * average, and volume confirms. Exits either when OBV turns down OR when price
 * closes more than 5x ATR below the highest close since entry (whichever first).
 * When it does NOT work: a wide trail still exits on deep normal pullbacks in
 * choppy range-bound regimes, and if ATR is large it barely constrains anything, so
 * it inherits the family's drawdown in slow grinding bear markets.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) {
    ctx.watch([]);
    return null;
  }

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) {
    ctx.watch([]);
    return null;
  }
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 31];
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  // GENTLE volatility-target sizing, same as champion.
  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  if (pos > 0) {
    // Track highest close since entry for the trailing stop.
    const hi = st.hi ? Math.max(st.hi, price) : price;
    st.hi = hi;
    // Wide trail: 5x ATR below the peak. Wide enough to survive normal pullbacks
    // (which are ~2-3 ATR) but catches violent reversals. Chosen a priori.
    const trailStop = hi - 5 * atr;
    const stopped = price < trailStop;

    // 표시 전용: 현재 포지션의 청산 대기선
    const exitWatch = [];
    if (Number.isFinite(trailStop) && trailStop > 0) {
      exitWatch.push({ side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail' });
    }
    exitWatch.push({ side: 'sell', conds: [{ label: 'OBV falling', ok: falling }], note: 'OBV turn exit' });
    ctx.watch(exitWatch);

    if (stopped && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // 표시 전용: 진입 대기선
  const entryWatch = [{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'price above SMA100',
    conds: [
      { label: 'OBV rising', ok: rising },
      { label: 'volume confirms', ok: volOk },
      { label: 'cooldown done', ok: cd === 0 }
    ]
  }];
  ctx.watch(entryWatch);

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    ctx.state.hi = price;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
