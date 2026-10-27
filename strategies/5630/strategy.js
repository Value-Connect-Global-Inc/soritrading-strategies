/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + Dollar Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trades as a dollar-inverse risk asset — when the US
 * dollar strengthens, liquidity drains from crypto; when it weakens, risk
 * appetite returns. The proven OBV volume-flow trend finds accumulation-driven
 * uptrends; gating its entries on a weak-dollar regime (DXY below its 200-day
 * average) filters out the entries that historically precede bear markets.
 * When it buys and sells: buys when smoothed OBV is rising vs ~30 days earlier,
 * price is above its 200-day average, volume confirms, AND the dollar is below
 * its 200-day average (weak-dollar regime). Sells when OBV turns down.
 * Hysteresis + cooldown cut churn.
 * When it does NOT work: during strong-dollar rallies where BTC still rises on
 * its own (e.g. regulatory-driven squeezes) the gate wrongly keeps you out;
 * macro data is weekly and lags, so regime flips are slow.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Dollar regime: DXY below its own 200d average = weak dollar = risk-on for BTC.
  const dxy = ctx.data('base_dxy_h10');
  let dxyWeak = true; // if dollar data missing, don't block (fall back to pure trend)
  if (dxy != null && Number.isFinite(dxy)) {
    const st0 = ctx.state;
    if (st0.lastI !== ctx.i) {
      st0.dxyHist = st0.dxyHist || [];
      st0.dxyHist.push(dxy);
      if (st0.dxyHist.length > 201) st0.dxyHist.shift();
      st0.lastI = ctx.i;
    }
    const h = st0.dxyHist || [dxy];
    if (h.length >= 201) {
      let sum = 0;
      for (let k = h.length - 200; k < h.length; k++) sum += h[k];
      const dxySma = sum / 200;
      dxyWeak = dxy < dxySma;
    }
  }

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

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'OBV flip exit', conds: [{ label: 'OBV(30) falling', ok: falling }] }
    ]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'OBV rising + weak $', conds: [
      { label: 'OBV(30) rising', ok: rising },
      { label: 'Price > SMA200', ok: price > sma200 },
      { label: 'Volume > avg30', ok: volOk },
      { label: 'DXY < DXY200', ok: dxyWeak }
    ]}
  ]);
  if (rising && price > sma200 && volOk && dxyWeak && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
