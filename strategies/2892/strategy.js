/*
 * @coinsori-strategy v1
 * name: FearGreed-Gated OBV Trend BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated 45d OBV trend champion's documented
 * weakness is buying late into extreme-greed melt-up tops. The Crypto Fear &
 * Greed index (working user dataset) measures crowd euphoria; extreme greed
 * (>80) historically marks late-stage tops where trend entries are risky.
 * This variant adds a fear-greed regime gate on top of the champion recipe.
 * When it buys and sells: buys when 45-day OBV is rising AND price is above
 * the 100-day average AND volume confirms AND the fear-greed index is NOT at
 * extreme greed; sells when 45-day OBV turns down by 1.5%.
 * When it does NOT work: if a melt-up keeps running after extreme greed, the
 * gate keeps the strategy out of the final (largest) leg of the rally — it
 * sacrifices upside to avoid late entries. In prolonged euphoria it can sit
 * in cash for long stretches.
 * 2026-02-06: ctx.watch 선언만 추가 — 표시만 바뀜, 매매 판단은 그대로.
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

  const LOOKBACK = 45;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < LOOKBACK + 2) {
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
  if (obvSeries.length < LOOKBACK + 1) {
    ctx.watch([]);
    return null;
  }
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 1 - LOOKBACK];
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.985;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  // Fear-greed regime gate: skip entries at extreme greed (>80 = euphoric top risk).
  // Uses the user's working fear_greed dataset; null = data unknown, let the trend decide.
  const fg = ctx.data('fg');
  const fgOk = fg != null && Number.isFinite(fg);
  const greedGate = fgOk ? fg <= 80 : true;

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
      qty: pos,
      note: '45d OBV -1.5% exit',
      conds: [
        { label: '45d OBV falling', ok: falling },
        { label: 'cooldown ready', ok: cd === 0 }
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
    note: 'price > SMA100',
    conds: [
      { label: '45d OBV rising', ok: rising },
      { label: 'volume > avg30', ok: volOk },
      { label: 'FG not extreme greed', ok: greedGate },
      { label: 'cooldown ready', ok: cd === 0 }
    ]
  }]);

  if (rising && price > sma100 && volOk && greedGate && cd === 0) {
    ctx.state.cd = 5;
    const qty = ctx.cash / price * 0.95 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
