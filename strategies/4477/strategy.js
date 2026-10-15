/*
 * @coinsori-strategy v1
 * name: OBV Volume-Flow Trend ETH 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same volume-flow signal family as the validated BTC OBV
 * strategy, applied to ETH. On-Balance Volume accumulates up-day volume and
 * subtracts down-day volume, tracking whether money flows in or out over time.
 * A rising OBV trend with price above its 200-day average confirms an
 * accumulation-driven uptrend. This is a genuinely different signal source
 * (volume, not price or on-chain) and a different asset than the BTC
 * active-address champion, so it diversifies the portfolio.
 * When it buys and sells: buys when smoothed OBV is clearly rising vs ~30 days
 * ago AND price is above its 200-day average AND today's volume is above its
 * 30-day average; sells when smoothed OBV turns down, or on a 20% hard stop.
 * When it does NOT work: OBV can diverge from price for long stretches in
 * choppy sideways markets (whipsaw), and like all trend signals it lags sharp
 * V-shaped melt-ups. ETH is more volatile than BTC, so drawdowns are larger.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // 200-day trend gate: only hold longs in a confirmed bull regime.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Build OBV from volume and close direction.
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

  // Hysteresis: 1% both sides to cut whipsaw churn.
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  // Volume confirmation: only enter when today's volume is above its 30-day
  // average — a rising OBV on quiet volume is a weak drift, not accumulation.
  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  // Cooldown: after a flip, wait 5 bars before flipping again (cuts whipsaw).
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    // hard stop: 20% below entry — ETH is more volatile than BTC, so a 15%
    // BTC-style stop would be whipsawed by normal ETH noise.
    const stop = ctx.entryPx == null ? null : ctx.entryPx * 0.80;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' }]);
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'price above 200-day SMA',
               conds: [{ label: 'OBV rising', ok: rising, closed: true },
                       { label: 'vol > 30d avg', ok: volOk, closed: true }] }]);
  if (rising && price > sma200 && volOk && cd === 0) {
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
