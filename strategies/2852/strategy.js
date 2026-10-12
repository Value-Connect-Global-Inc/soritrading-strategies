/*
 * @coinsori-strategy v1
 * name: Fed-Filtered OBV Trend BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV volume-flow trend family captures bull momentum
 * but carries high drawdown (MDD ~29-50%) because it stays long through
 * hiking-period bears. The Fed not-hiking regime is a slow macro gate that
 * sits out tightening cycles. This combines them: only take OBV trend entries
 * while the Fed is not hiking, so the macro gate filters out the worst
 * hiking-bear drawdowns without giving up the trend family's bull capture.
 * When it buys and sells: buys when 30-day OBV is rising AND price is above
 * the 100-day average AND volume confirms AND the Fed is not hiking (current
 * fed funds rate not above its level 30 days ago). Exits fully when OBV turns
 * down OR a Fed hiking cycle begins.
 * When it does NOT work: crypto can melt up even while the Fed hikes
 * (liquidity-driven bulls), so the fed gate can sit out strong rallies the
 * pure trend family would catch. And the fed signal is slow to flip back
 * after a hike ends, so re-entry can be delayed.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
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

  // Fed macro gate: hiking if current rate is above 30-day-ago level by a
  // 0.25pp buffer (one typical hike) to avoid churn on tiny moves.
  const now = Number(ctx.data('fed'));
  const lag = Number(ctx.data('fed_lag30'));
  if (!Number.isFinite(now) || now <= 0) {
    ctx.watch([]);
    return null;
  }
  if (!Number.isFinite(lag) || lag <= 0) {
    ctx.watch([]);
    return null;
  }
  const hiking = now > lag + 0.25;

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

  // Gentle volatility-target sizing: full size up to 6% ATR, scale linearly
  // to 50% size at 12% ATR. Only extreme stress cuts exposure.
  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      note: 'OBV downturn or Fed hike exit',
      conds: [
        { label: 'OBV 30D falling', ok: falling },
        { label: 'Fed hiking', ok: hiking },
        { label: 'Cooldown ready', ok: cd === 0 }
      ]
    }]);
    if ((falling || hiking) && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'OBV uptrend + macro filter entry',
    conds: [
      { label: 'OBV 30D rising', ok: rising },
      { label: 'Volume > avg(30)', ok: volOk },
      { label: 'Fed not hiking', ok: !hiking },
      { label: 'Cooldown ready', ok: cd === 0 }
    ]
  }]);

  if (rising && price > sma100 && volOk && !hiking && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
