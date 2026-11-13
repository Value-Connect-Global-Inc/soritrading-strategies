/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Funding rates on perpetual futures tell us which side is crowded.
 * When funding is far above its own recent average, longs are paying a lot to stay long
 * — the crowd is over-bullish, a contrarian short signal. When funding is far below its
 * own average (even negative), shorts are crowded — a contrarian long signal. We bet the
 * crowd is often wrong at the extremes and mean-reversion follows.
 * When it buys and sells: Short when funding is more than 1.2 standard deviations above
 * its own rolling recent mean. Long when funding is more than 1.2 standard deviations
 * below its own recent mean. Each position has a hard stop of 3x ATR and a take-profit
 * of 3x ATR, and we only hold one position at a time.
 * When it does NOT work: In a strong persistent trend, funding stays extreme for a long
 * time and going against the crowd loses while the trend keeps running. This strategy is
 * a mean-reversion bet and bleeds in trending markets where the crowd is right.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const fund = ctx.funding; // current funding rate on this perp (fraction per interval)
  const atr = ctx.atr(14, 1);
  if (fund == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling history of funding to compute its own z-score (relative shape, not fixed level).
  let hist = Array.isArray(ctx.state.fundHist) ? ctx.state.fundHist : [];
  hist = hist.concat([fund]);
  if (hist.length > 60) hist = hist.slice(-60); // ~60 funding intervals of context
  ctx.state.fundHist = hist;
  const n = hist.length;
  if (n < 30) { ctx.watch([]); return null; } // need enough history for a stable mean/sd
  let mean = 0;
  for (const h of hist) mean += h;
  mean /= n;
  let sd = 0;
  for (const h of hist) sd += (h - mean) * (h - mean);
  sd = Math.sqrt(sd / n);
  const z = sd > 0 ? (fund - mean) / sd : 0;

  const LONG_Z = -1.2;   // crowded shorts -> contrarian long
  const SHORT_Z = 1.2;   // crowded longs -> contrarian short
  const stopDist = 3 * atr;      // hard stop caps single-trade loss
  const tpDist = 3 * atr;        // take profit: symmetric reward

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    if (entryPx == null) { ctx.watch([]); return null; }
    const stop = entryPx - stopDist;
    const tp = entryPx + tpDist;
    // Exit long when funding turns back toward normal (crowd unwinds) or on stop/TP.
    const exitZ = z > 0; // funding back above its mean: long is no longer contrarian
    const watch = [
      { side: 'sell', price: stop, trigger: 'below', note: 'stop' },
      { side: 'sell', price: tp, trigger: 'above', note: 'target' },
      { side: 'sell', price: entryPx, trigger: 'above', note: 'funding normal', conds: [{ label: 'fund z', now: z, op: '>', ref: 0, closed: true }] }
    ];
    if (price <= stop || price >= tp || exitZ) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  if (pos < 0) {
    const entryPx = ctx.entryPx;
    if (entryPx == null) { ctx.watch([]); return null; }
    const stop = entryPx + stopDist;
    const tp = entryPx - tpDist;
    const exitZ = z < 0; // funding back below its mean: short is no longer contrarian
    const watch = [
      { side: 'buy', price: stop, trigger: 'above', note: 'stop' },
      { side: 'buy', price: tp, trigger: 'below', note: 'target' },
      { side: 'buy', price: entryPx, trigger: 'below', note: 'funding normal', conds: [{ label: 'fund z', now: z, op: '<', ref: 0, closed: true }] }
    ];
    if (price <= tp || price >= stop || exitZ) {
      ctx.watch(watch);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  // Flat: enter on extreme funding.
  const sizeFrac = 0.5; // keep half-size: funding extremes are noisy, don't risk the account
  if (z <= LONG_Z) {
    const qty = (ctx.cash / price) * sizeFrac;
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'crowded shorts', conds: [{ label: 'fund z', now: z, op: '<=', ref: LONG_Z, closed: true }] }]);
    return { side: 'buy', qty };
  }
  if (z >= SHORT_Z) {
    const qty = (ctx.cash / price) * sizeFrac;
    ctx.watch([{ side: 'sell', price: price, trigger: 'above', note: 'crowded longs', conds: [{ label: 'fund z', now: z, op: '>=', ref: SHORT_Z, closed: true }] }]);
    return { side: 'sell', qty };
  }
  ctx.watch([]);
  return null;
}
