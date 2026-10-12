/*
 * @coinsori-strategy v1
 * name: OBV Trend Vol-Scaled Champion 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV volume-flow trend family is validated across
 * BTC/ETH/SOL — it captures bull momentum the mean-reversion champion misses.
 * Adding GENTLE volatility-targeted position sizing (scale size down only in
 * extreme stress, ATR > 6% of price) improved it further: it trims exposure in
 * the most volatile stretches, cutting drawdown without giving up normal bull
 * capture. Validated on BTC/ETH/SOL walk-forward windows.
 * When it buys and sells: buys when 30-day OBV is clearly rising AND price is
 * above the 200-day average AND volume confirms. Position size is scaled by
 * inverse volatility, but only cuts in extreme stress (ATR > 6% of price, never
 * below half size). Exits fully when OBV turns down.
 * When it does NOT work: in a steady grinding bull where vol stays low it
 * under-risks slightly; and it still lags the sharpest V-shaped melt-ups.
 * 
 * 2025-01-01: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 추가)
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null) return null;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) return null;

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) return null;
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

  // GENTLE volatility-target sizing: full size up to 6% ATR; scale linearly to
  // 50% size at 12% ATR. Only extreme stress cuts exposure, never below half.
  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  if (pos > 0) {
    // Declare exit wait: OBV falling (30-day) triggers full exit
    ctx.watch([{
      side: 'sell',
      price: price, // current price reference (no specific exit level — OBV condition)
      trigger: 'below',
      note: 'OBV 30d falling',
      conds: [
        { label: 'OBV now vs 30d ago', now: obvNow, op: '<', ref: obvPast * 0.99, closed: true },
        { label: 'Cooldown', ok: cd === 0 }
      ]
    }]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Declare entry wait: OBV rising + price > SMA200 + volume confirm
  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'SMA200 + OBV rising + vol',
    conds: [
      { label: 'OBV now vs 30d ago', now: obvNow, op: '>', ref: obvPast * 1.01, closed: true },
      { label: 'Price vs SMA200', now: price, op: '>', ref: sma200, closed: true },
      { label: 'Volume > avg30', ok: volOk },
      { label: 'Cooldown', ok: cd === 0 }
    ]
  }]);

  if (rising && price > sma200 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
