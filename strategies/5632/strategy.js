/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + NDX Risk Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto trades as a high-beta version of US equities — when
 * the NASDAQ is in an uptrend, risk appetite is on and crypto rallies follow;
 * when NDX is below its 200-day average, risk is off and crypto drops faster.
 * The proven OBV volume-flow trend finds accumulation-driven BTC uptrends; the
 * NDX gate only lets those entries through when the equity risk-on regime is up.
 * When it buys and sells: buys when smoothed OBV is rising vs ~30 days earlier,
 * price is above its 200-day average, volume confirms, AND NDX is above its own
 * 200-day average. Sells when OBV turns down. Hysteresis + cooldown cut churn.
 * When it does NOT work: crypto can decouple from equities for weeks (own
 * regulatory/on-chain catalysts), so the gate may keep you out of a BTC-only
 * rally; equity data is daily and lags the crypto move.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Risk-on gate: NDX above its 200d average = equity risk appetite on.
  const ndx = ctx.data('base_ndx');
  let riskOn = true; // if NDX missing, fall back to pure trend
  if (ndx != null && Number.isFinite(ndx)) {
    const st0 = ctx.state;
    if (st0.lastI !== ctx.i) {
      st0.ndxHist = st0.ndxHist || [];
      st0.ndxHist.push(ndx);
      if (st0.ndxHist.length > 201) st0.ndxHist.shift();
      st0.lastI = ctx.i;
    }
    const h = st0.ndxHist || [ndx];
    if (h.length >= 201) {
      let sum = 0;
      for (let k = h.length - 200; k < h.length; k++) sum += h[k];
      riskOn = ndx > sum / 200;
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
    { side: 'buy', price: price, trigger: 'above', note: 'OBV rising + NDX up', conds: [
      { label: 'OBV(30) rising', ok: rising },
      { label: 'Price > SMA200', ok: price > sma200 },
      { label: 'Volume > avg30', ok: volOk },
      { label: 'NDX > NDX200', ok: riskOn }
    ]}
  ]);
  if (rising && price > sma200 && volOk && riskOn && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
