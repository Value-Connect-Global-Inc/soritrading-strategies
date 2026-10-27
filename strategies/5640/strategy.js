/*
 * @coinsori-strategy v1
 * name: BTC OBV Trend + Vol-Target ATR14 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the proven OBV trend finds BTC uptrends but fixed sizing
 * means a high-vol crash hits the whole account. Volatility targeting sizes
 * positions inversely to ATR(14). Target 2% daily vol, size = 0.02/(ATR14/price).
 * When it buys and sells: OBV(30) volume-flow trend entries above SMA200 with
 * volume confirmation; exits on OBV flip or SMA200 break.
 * When it does NOT work: in a low-vol grind-up it sizes up and a sudden vol
 * spike still hurts; sizing cannot fully replace a good exit.
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
    const atr = ctx.atr(14, 1);
    let frac = 0.95;
    if (atr != null && atr > 0) {
      const dailyVol = atr / price;
      frac = 0.02 / dailyVol;
      frac = Math.max(0.2, Math.min(0.95, frac));
    }
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * frac };
  }
  return null;
}
