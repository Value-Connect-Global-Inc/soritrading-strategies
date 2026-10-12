/*
 * @coinsori-strategy v1
 * name: OBV Trend Relaxed Gate + Fed Buy-Blocker 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV volume-flow trend with a relaxed 100-day bull gate
 * captures early melt-ups and is the validated champion of this family. Its one
 * remaining weakness is that the relaxed gate re-enters too eagerly during
 * range-bound chop — which is exactly what a Fed tightening cycle produces
 * (2018, 2022 bears). The Fed-funds tightening signal is independently validated
 * as a diverse macro family on BTC/SOL 1D. This version BLOCKS new buys while
 * the Fed is actively hiking, keeping the bull capture but standing aside in
 * policy-driven chop. It does NOT change the proven OBV exits.
 * When it buys and sells: buys when 30-day OBV is rising, price is above the
 * 100-day average, volume confirms, AND the Fed is not in an active hiking step.
 * Exits fully when OBV turns down. Position is scaled down gently in extreme
 * volatility stress (ATR > 6% of price, never below half).
 * When it does NOT work: it still inherits the family's high drawdown inside a
 * non-hiking crash (no price stop — only the policy gate blocks buys); and if
 * the Fed data feed is unavailable the buy-blocker silently does nothing, so it
 * degrades to the plain champion rather than failing.
 *
 * 2025-06-11 표시만 바뀜, 매매 판단은 그대로
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

  // GENTLE volatility-target sizing: full size up to 6% ATR; scale linearly to
  // 50% size at 12% ATR. Only extreme stress cuts exposure, never below half.
  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      note: 'OBV trend down',
      conds: [
        { label: 'OBV(30) falling', ok: falling },
        { label: 'cooldown ready', ok: cd === 0 },
      ],
    }]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Fed tightening buy-blocker: no NEW buys while the Fed is actively hiking.
  // 0.5pp = one typical Fed step above the level ~30 rows ago. If the data feed
  // is unavailable (null) we do NOT block — degrade to the plain champion.
  const fedNow = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  let tightening = false;
  if (fedNow != null && fedLag != null) {
    tightening = fedNow > fedLag + 0.5;
  }

  ctx.watch([{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'close above SMA100',
    conds: [
      { label: 'OBV(30) rising', ok: rising },
      { label: 'volume confirms', ok: volOk },
      { label: 'cooldown ready', ok: cd === 0 },
      { label: 'Fed not hiking', ok: !tightening },
    ],
  }]);

  if (rising && price > sma100 && volOk && cd === 0 && !tightening) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
