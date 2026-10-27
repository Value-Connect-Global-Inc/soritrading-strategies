/*
 * @coinsori-strategy v1
 * name: BTC OBV Volume-Flow Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated BTC 1d OBV volume-flow champion, run on 4h bars to react faster.
 * A rising smoothed OBV with price above its 200-bar average and above-average volume confirms
 * accumulation; a falling OBV warns of distribution. Testing whether the edge survives a shorter
 * (more active) timeframe.
 * When it buys and sells: buys when OBV is clearly rising vs ~30 bars earlier AND price is above its
 * 200-bar average AND volume is above its 30-bar average; sells when OBV turns down. Hysteresis +
 * cooldown reduce churn.
 * When it does NOT work: shorter timeframes whipsaw more in chop and pay more fees; OBV can diverge
 * from price for long stretches in sideways markets. It also lags sharp V-shaped melt-ups.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // OBV now vs 30 bars ago (platform indicator, O(1) — no manual recompute loop).
  const obvNow = ctx.obv(30, 0);
  const obvPast = ctx.obv(30, 30);
  if (obvNow == null || obvPast == null || obvPast === 0) return null;

  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.99;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (rising && price > sma200 && volOk && cd === 0) {
    ctx.state.cd = 5;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
