/*
 * @coinsori-strategy v1
 * name: BTC Funding-Contrarian Long-Short 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In BTC perpetuals the funding rate shows which side the crowd is over-leveraged
 * on. Fading extreme funding (long when shorts are crowded, short when longs are crowded) captures
 * the unwind, and being able to short gives return in falling markets that simply holding cannot.
 * When it buys and sells: Long when funding is far below its own recent history AND price is above the
 * 200-bar EMA; short when funding is far above its own history AND price is below the 200-bar EMA.
 * Exit when funding normalizes or price hits a hard ATR stop.
 * When it does NOT work: In a one-way melt-up or melt-down, funding can stay extreme for a long time and
 * the fade loses money before the unwind. Strong persistent trends break it.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;
  const position = ctx.position || 0;

  const ema = ctx.ema(200, 1);
  if (ema == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const f = ctx.funding;
  if (f == null) return null;

  // rolling funding history kept in restart-safe state -> z-score, not a fixed level
  let hist = ctx.state.fundHist;
  if (!Array.isArray(hist)) hist = [];
  hist.push(f);
  if (hist.length > 400) hist = hist.slice(-400);
  ctx.state.fundHist = hist;
  if (hist.length < 80) return null;

  const n = hist.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += hist[i];
  mean /= n;
  let sd = 0;
  for (let i = 0; i < n; i++) sd += (hist[i] - mean) * (hist[i] - mean);
  sd = Math.sqrt(sd / n);
  const z = sd > 1e-12 ? (f - mean) / sd : 0;

  const prevClose = ctx.closes.at(-2);

  if (position > 0) {
    // long exit: hard stop 2.5 ATR below entry, or funding back to normal (z > -0.3)
    const stop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
    ctx.watch([
      { side:'sell', price: stop, trigger:'below', note:'ATR stop' },
      { side:'sell', note:'fund norm', conds:[{ label:'fund z', now: z, op:'>', ref: -0.3, closed:true }] }
    ]);
    if (stop != null && price <= stop) return { side:'sell', qty: position, reduceOnly:true };
    if (z > -0.3) return { side:'sell', qty: position, reduceOnly:true };
    return null;
  }
  if (position < 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx + 2.5 * atr : null;
    ctx.watch([
      { side:'buy', price: stop, trigger:'above', note:'ATR stop' },
      { side:'buy', note:'fund norm', conds:[{ label:'fund z', now: z, op:'<', ref: 0.3, closed:true }] }
    ]);
    if (stop != null && price >= stop) return { side:'buy', qty: -position, reduceOnly:true };
    if (z < 0.3) return { side:'buy', qty: -position, reduceOnly:true };
    return null;
  }

  // entries: fade extreme funding, only in the direction of the slow trend
  ctx.watch([
    { side:'buy', price: ema, trigger:'above', note:'EMA200 up', conds:[{ label:'fund z', now: z, op:'<', ref: -1.0, closed:true }] },
    { side:'sell', price: ema, trigger:'below', note:'EMA200 down', conds:[{ label:'fund z', now: z, op:'>', ref: 1.0, closed:true }] }
  ]);

  if (z < -1.0 && prevClose > ema) {
    return { side:'buy', qty: (cash * 0.9) / price };
  }
  if (z > 1.0 && prevClose < ema) {
    return { side:'sell', qty: (cash * 0.9) / price };
  }
  return null;
}
