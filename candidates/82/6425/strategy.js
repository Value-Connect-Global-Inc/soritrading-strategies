/*
 * @coinsori-strategy v1
 * name: BTC Funding Crowding Long/Short 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the funding rate shows how crowded one side of the perpetual
 * market is. Extremely positive funding = longs pay shorts (crowded longs, squeeze
 * risk down); extremely negative = shorts pay longs (crowded shorts, squeeze up).
 * Fading extremes WITH a trend filter gives a return source buy-and-hold lacks — shorts.
 *
 * When it buys and sells: LONG when funding is far below normal AND price is above its
 * 200-bar average; SHORT when funding is far above normal AND price is below its average.
 * Exits when funding normalizes, the trend filter flips, or a 3*ATR hard stop hits.
 *
 * When it does NOT work: a strong one-way trend keeps funding extreme for a long time,
 * so fading it early loses; sideways chop whipsaws and pays fees both ways.
 */
function onUpdate(ctx) {
  const f = ctx.funding;
  const p = ctx.closes.at(-2);
  if (f == null || p == null) return null;
  const sma = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma == null || atr == null) return null;

  // rolling funding history -> z-score (shape vs its own mean, not a fixed level)
  const WIN = 90;
  let hist = Array.isArray(ctx.state.fundHist) ? ctx.state.fundHist.slice() : [];
  hist.push(f);
  if (hist.length > WIN) hist.shift();
  ctx.state.fundHist = hist;
  if (hist.length < 30) return null;
  let mean = 0;
  for (const x of hist) mean += x;
  mean /= hist.length;
  let sd = 0;
  for (const x of hist) sd += (x - mean) * (x - mean);
  sd = Math.sqrt(sd / hist.length);
  const z = sd > 0 ? (f - mean) / sd : 0;

  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const stopDist = 3 * atr;
  // risk 2% of cash per trade on the hard stop
  const qty = (ctx.cash * 0.02) / stopDist;

  const orders = [];
  const watch = [];

  if (pos === 0) {
    if (z <= -1.5 && p > sma) {
      orders.push({ side: 'buy', qty: qty });
      watch.push({ side: 'buy', price: sma, trigger: 'above', note: 'low funding + uptrend',
        conds: [{ label: 'funding z', now: z, op: '<=', ref: -1.5, closed: true }] });
    } else if (z >= 1.5 && p < sma) {
      orders.push({ side: 'sell', qty: qty });
      watch.push({ side: 'sell', price: sma, trigger: 'below', note: 'high funding + downtrend',
        conds: [{ label: 'funding z', now: z, op: '>=', ref: 1.5, closed: true }] });
    }
  } else if (pos > 0) {
    const stop = (entry != null ? entry : p) - stopDist;
    const exit = p <= stop || z >= 0 || p < sma;
    if (exit) orders.push({ side: 'sell', qty: Math.abs(pos), reduceOnly: true });
    watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'long stop' });
    watch.push({ side: 'sell', price: sma, trigger: 'below', note: 'trend flip' });
  } else {
    const stop = (entry != null ? entry : p) + stopDist;
    const exit = p >= stop || z <= 0 || p > sma;
    if (exit) orders.push({ side: 'buy', qty: Math.abs(pos), reduceOnly: true });
    watch.push({ side: 'buy', price: stop, trigger: 'above', note: 'short stop' });
    watch.push({ side: 'buy', price: sma, trigger: 'above', note: 'trend flip' });
  }

  ctx.watch(watch);
  return orders.length ? orders : null;
}
