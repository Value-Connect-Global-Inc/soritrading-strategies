/*
 * @coinsori-strategy v1
 * name: BTC Funding-Contrarian Both-Sides 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: Perpetual funding is crowd positioning. When funding is far below its own recent
 * average, shorts are crowded and paying longs — a squeeze usually follows. When it is far
 * above, longs are crowded and a pullback usually follows. Betting against the crowd is a
 * different edge than trend-following, which has repeatedly failed on BTC 4h.
 * When it buys/sells: buy when price is above the 200-bar SMA (uptrend) AND funding z-score
 * < -1.5 (crowded shorts); sell short when price is below the 200-SMA (downtrend) AND funding
 * z-score > +1.5 (crowded longs). Exit when funding returns to its average (z crosses 0) or
 * price hits a 3xATR stop.
 * When it fails: in a one-way crash funding can stay deeply negative for weeks while price
 * keeps falling (long side bleeds), and in a melt-up funding stays positive while price rises
 * (short side bleeds). The trend gate and the 3xATR stop are the only protection.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);
  if (close == null) return null;

  // ---- funding z-score vs its own trailing history ----
  const f = ctx.funding;
  if (f == null) return null;
  let hist = ctx.state.fHist || [];
  if (hist.length === 0 || Math.abs(f - hist[hist.length - 1]) > 1e-12) {
    hist.push(f);
    if (hist.length > 200) hist = hist.slice(-200);
  }
  ctx.state.fHist = hist;
  if (hist.length < 90) return null;   // ~30 days of funding samples (updates every 8h)

  let sum = 0;
  for (let k = 0; k < hist.length; k++) sum += hist[k];
  const mean = sum / hist.length;
  let sd = 0;
  for (let k = 0; k < hist.length; k++) sd += (hist[k] - mean) * (hist[k] - mean);
  sd = Math.sqrt(sd / (hist.length - 1));
  if (!(sd > 1e-9)) return null;
  const z = (f - mean) / sd;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const pos = ctx.position || 0;
  const inLong = pos > 1e-9;
  const inShort = pos < -1e-9;
  const entryPx = ctx.entryPx;
  const stopDist = 3 * atr;   // 3xATR stop: wider than noise, tight enough to cap a wrong crowd bet

  // ---- exits ----
  if (inLong) {
    const stop = (entryPx == null ? close : entryPx) - stopDist;
    if (z > 0) {
      // funding back to average = squeeze over, take profit
      ctx.watch([{ side: 'sell', price: close, trigger: 'below', note: 'funding normalized',
        conds: [{ label: 'funding z', now: z, op: '>', ref: 0, closed: true }] }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (close < stop) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'long stop 3xATR' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'long stop 3xATR' },
      { side: 'sell', price: close, trigger: 'below', note: 'funding normalized',
        conds: [{ label: 'funding z', now: z, op: '>', ref: 0, closed: true }] }
    ]);
    return null;
  }

  if (inShort) {
    const stop = (entryPx == null ? close : entryPx) + stopDist;
    if (z < 0) {
      ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'funding normalized',
        conds: [{ label: 'funding z', now: z, op: '<', ref: 0, closed: true }] }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    if (close > stop) {
      ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: 'short stop 3xATR' }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.watch([
      { side: 'buy', price: stop, trigger: 'above', note: 'short stop 3xATR' },
      { side: 'buy', price: close, trigger: 'above', note: 'funding normalized',
        conds: [{ label: 'funding z', now: z, op: '<', ref: 0, closed: true }] }
    ]);
    return null;
  }

  // ---- entries (flat) ----
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  if (!allocOk) { ctx.watch([]); return null; }

  const riskFrac = 0.02;   // risk 2% of cash per trade on the stop
  const qty = (ctx.cash * riskFrac) / stopDist;

  if (close > sma200 && z < -1.5) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + crowded shorts',
      conds: [{ label: 'funding z', now: z, op: '<', ref: -1.5, closed: true }] }]);
    return { side: 'buy', qty: qty };
  }
  if (close < sma200 && z > 1.5) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'downtrend + crowded longs',
      conds: [{ label: 'funding z', now: z, op: '>', ref: 1.5, closed: true }] }]);
    return { side: 'sell', qty: qty };
  }
  ctx.watch([]);
  return null;
}
