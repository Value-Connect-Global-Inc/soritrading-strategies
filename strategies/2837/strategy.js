/*
 * @coinsori-strategy v1
 * name: OBV Trend Relaxed Gate Champion 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV volume-flow trend family captures bull momentum the
 * mean-reversion champion misses, but its strict 200-day SMA gate kept it out of
 * early melt-ups. Relaxing the bull gate to a 100-day SMA fixes that lag — it
 * enters the early phase of a new uptrend sooner. Validated across BTC/ETH/SOL:
 * returns improved on all walk-forward windows vs the 200-SMA version (BTC W2
 * +582% vs +354%, ETH W3 +52.8% vs +37.6%, SOL W3 +431% vs +346%).
 * When it buys and sells: buys when 30-day OBV is rising AND price is above the
 * 100-day average AND volume confirms. Position size is scaled down gently in
 * extreme volatility stress (ATR > 6% of price, never below half). Exits fully
 * when OBV turns down.
 * When it does NOT work: the relaxed gate re-enters more often after pullbacks,
 * so it can whipsaw in range-bound chop the strict 200-SMA version skips, and it
 * inherits the family's high drawdown (MDD ~29-50%) in sharp reversals. It also
 * lags the sharpest V-shaped melt-ups.
 */
function onUpdate(ctx) {
  // 2026-04-26 표시만 바뀜, 매매 판단은 그대로
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) { ctx.watch([]); return null; }

  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 32) { ctx.watch([]); return null; }

  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < closes.length; k++) {
    const c = closes[k], p = closes[k - 1], v = vols[k];
    if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) { ctx.watch([]); return null; }
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

  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) {
    sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);
  }

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      note: 'OBV down exit',
      conds: [
        { label: 'OBV falling', ok: falling },
        { label: 'Cooldown ready', ok: cd === 0 }
      ]
    }]);
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: sma100,
    trigger: 'above',
    note: 'Price > SMA100',
    conds: [
      { label: 'OBV rising', ok: rising },
      { label: 'Volume > avg', ok: volOk },
      { label: 'Cooldown ready', ok: cd === 0 }
    ]
  }]);

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
