// 2026-04-11 표시만 바뀜, 매매 판단은 그대로
/*
 * @coinsori-strategy v1
 * name: OBV Trend Fast Lookback 15d BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV trend champion (2820) uses a 30-day OBV lookback,
 * which lags the start of a new trend and holds too long into reversals — its
 * MDD is ~29-50%. A faster 15-day OBV lookback should react sooner to trend
 * changes, entering melt-ups earlier and cutting losses faster, trading some
 * return for a lower drawdown.
 * When it buys and sells: buys when the 15-day OBV is rising AND price is above
 * the 100-day average AND volume confirms; exits fully when the 15-day OBV turns
 * down. Position size is scaled down in extreme volatility stress.
 * When it does NOT work: the faster lookback whipsaws more in choppy,
 * range-bound markets — it turns down on short pullbacks and re-enters
 * repeatedly, churning fees where the slower 30-day version stays calm.
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
  if (!closes || !vols || closes.length < 17) {
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
  if (obvSeries.length < 17) {
    ctx.watch([]);
    return null;
  }
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 16];
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

  const watchEntries = [];
  if (pos > 0) {
    watchEntries.push({
      side: 'sell',
      note: 'OBV 15D downtrend exit',
      conds: [
        { label: 'OBV 15D falling', ok: falling },
        { label: 'cooldown ready', ok: cd === 0 }
      ]
    });
  } else {
    watchEntries.push({
      side: 'buy',
      note: 'OBV 15D uptrend entry',
      conds: [
        { label: 'OBV 15D rising', ok: rising },
        { label: 'Price > SMA100', now: price, op: '>', ref: sma100 },
        { label: 'Volume > avg30', ok: volOk },
        { label: 'cooldown ready', ok: cd === 0 }
      ]
    });
  }
  ctx.watch(watchEntries);

  if (pos > 0) {
    if (falling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (rising && price > sma100 && volOk && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
