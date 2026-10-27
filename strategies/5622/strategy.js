/*
 * @coinsori-strategy v1
 * name: BTC OBV + 20d Breakout Confirm 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: volume flow (On-Balance Volume) plus a real price breakout.
 * The OBV-only trend whipsaws in sideways chop because OBV drifts up even when
 * price is stuck in a range. Requiring a new 20-day high filters those false starts.
 * When it buys and sells: buys when smoothed OBV is rising vs ~30 days earlier AND
 * price closes above its 200-day average AND price makes a new 20-day high AND
 * today's volume is above its 30-day average; sells when smoothed OBV turns down.
 * When it does NOT work: it enters later than pure OBV (waits for the breakout),
 * so it misses the very first leg of a fast V-shaped recovery, and in a slow
 * sideways grind it may sit out while price never clears 20-day highs.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const closes = ctx.closes;
  const vols = ctx.volumes;
  const highs = ctx.highs;
  if (!closes || !vols || !highs || closes.length < 32) return null;

  // OBV: add up-day volume, subtract down-day volume.
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

  // New 20-day high computed from closed bars only (indices len-21 .. len-2).
  // 20 days = one month, long enough to skip chop, short enough to catch trends.
  let hh = -Infinity;
  for (let k = closes.length - 21; k <= closes.length - 2; k++) {
    if (k >= 0 && Number.isFinite(highs[k]) && highs[k] > hh) hh = highs[k];
  }
  const breakout = Number.isFinite(hh) && price > hh;

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
    { side: 'buy', price: hh, trigger: 'above', note: '20d breakout entry', conds: [
      { label: 'OBV(30) rising', ok: rising },
      { label: 'Price > SMA200', ok: price > sma200 },
      { label: 'New 20d high', ok: breakout },
      { label: 'Volume > avg30', ok: volOk }
    ]}
  ]);
  if (rising && price > sma200 && breakout && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
