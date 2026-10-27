/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend Vol-Target 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the validated OBV volume-flow trend signal, improved with
 * volatility targeting. Instead of always risking ~95% of cash, position size is
 * scaled down when ATR is high (turbulent markets), so a crash hurts less. The
 * signal is unchanged — this only manages how much to risk.
 * When it buys and sells: buys when smoothed OBV is clearly rising vs ~30 days
 * earlier AND price above its 200-day average AND volume above its 30-day
 * average; sells when smoothed OBV turns down. Size = full position scaled by
 * (target ATR / current ATR), capped at full size.
 * When it does NOT work: same as any trend follower — OBV whipsaws in choppy
 * sideways markets, and it lags sharp V-shaped melt-ups. Vol targeting helps
 * drawdown but does not add alpha in calm trending markets.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

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

  // Volatility targeting: ATR(14) as % of price. Scale = targetVol / atrPct,
  // clamped to [0.5, 1.0]. targetVol 0.05 = milder scaling than 0.035 —
  // only cuts size meaningfully when ATR exceeds 5% of price.
  const atr = ctx.atr(14);
  if (atr == null || !Number.isFinite(atr) || atr <= 0) return null;
  const atrPct = atr / price;
  const targetVol = 0.05;
  let scale = targetVol / atrPct;
  if (scale > 1) scale = 1;
  if (scale < 0.5) scale = 0.5;

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
    { side: 'buy', price: price, trigger: 'above', note: 'OBV rising entry', conds: [
      { label: 'OBV(30) rising', ok: rising },
      { label: 'Price > SMA200', ok: price > sma200 },
      { label: 'Volume > avg30', ok: volOk }
    ]}
  ]);
  if (rising && price > sma200 && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    // vol-targeted size: full cash position scaled down in high-ATR regimes
    return { side: 'buy', qty: ctx.cash / price * 0.95 * scale };
  }
  return null;
}
