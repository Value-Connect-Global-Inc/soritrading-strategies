/*
 * @coinsori-strategy v1
 * name: BTC Perp Funding-Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On perpetual futures the funding rate is a positioning gauge. When funding is
 * extremely positive, longs are paying a lot to stay long — a crowded long that often flushes;
 * when it is extremely negative, shorts are paying — a crowded short that often squeezes. Instead of
 * following the trend, this strategy goes AGAINST the crowded side at funding extremes and exits
 * once funding normalizes, capturing the flush/squeeze.
 * When it buys and sells: Long when funding z-score (vs its own recent history) is very low (crowded
 * shorts), short when it is very high (crowded longs). Exit when funding returns to its norm, or a
 * 3xATR stop if the move runs against you.
 * When it does NOT work: In a quiet market funding stays near zero and extremes are rare, so it
 * trades little. In a strong one-way trend funding can stay extreme for weeks — the strategy fights
 * the trend and the stop takes repeated small losses. Funding is perpetual-only (no signal on spot).
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const price = ctx.price;
  const closes = ctx.closes;
  if (closes == null || closes.length < 60) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2);
  const highPrev = ctx.highs.at(-2);
  const lowPrev = ctx.lows.at(-2);
  if (closePrev == null || highPrev == null || lowPrev == null) { ctx.watch([]); return null; }

  const fund = ctx.funding;
  const atr = ctx.atr(14, 1);
  if (atr == null) { ctx.watch([]); return null; }

  // rolling funding history (funding updates ~every 8h; dedup consecutive values)
  let st = ctx.state || {};
  if (!Array.isArray(st.fundHist)) st.fundHist = [];
  if (fund != null) {
    const last = st.fundHist[st.fundHist.length - 1];
    if (last == null || Math.abs(last - fund) > 1e-12) st.fundHist.push(fund);
    if (st.fundHist.length > 400) st.fundHist = st.fundHist.slice(-400);
  }
  ctx.state = st;

  // z-score vs the last 60 recorded funding values — relative, adapts to bull vs bear funding baselines
  let fz = null;
  if (st.fundHist.length >= 60 && fund != null) {
    const arr = st.fundHist.slice(-60);
    let m = 0; for (const v of arr) m += v; m /= arr.length;
    let s = 0; for (const v of arr) s += (v - m) * (v - m); s = Math.sqrt(s / arr.length);
    if (s > 1e-9) fz = (fund - m) / s;
  }
  if (fz == null) { ctx.watch([]); return null; }

  // size so a 3xATR adverse move costs ~2% of equity; cap at full cash
  const qty = Math.max(0, Math.min(ctx.cash / price, (ctx.cash * 0.02) / (3 * atr)));

  if (pos === 0) {
    ctx.state = st;
    ctx.watch([
      { side: 'buy', price: price * (1 - 0.01), trigger: 'below', note: 'Long: funding extreme low (crowded shorts)' },
      { side: 'sell', price: price * (1 + 0.01), trigger: 'above', note: 'Short: funding extreme high (crowded longs)' }
    ]);
    // +/-1.5 z-score = an extreme vs its own recent norm, not a mild filter
    if (fz < -1.5 && qty > 0) {
      st.entryZ = fz;
      ctx.state = st;
      return { side: 'buy', qty };
    }
    if (fz > 1.5 && qty > 0) {
      st.entryZ = fz;
      ctx.state = st;
      return { side: 'sell', qty };
    }
    return null;
  }

  const entryZ = st.entryZ;
  if (pos > 0) {
    const stop = (ctx.entryPx != null ? ctx.entryPx : price) - 3 * atr;
    // exit when funding has normalized (z back toward 0) or the stop is hit
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'Long stop (3xATR)' },
      { side: 'sell', price: price * (1 - 0.005), trigger: 'below', note: 'Long exit: funding normalized' }
    ]);
    if (closePrev < stop || (entryZ != null && fz > 0)) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }

  // short position
  const stop = (ctx.entryPx != null ? ctx.entryPx : price) + 3 * atr;
  ctx.watch([
    { side: 'buy', price: stop, trigger: 'above', note: 'Short stop (3xATR)' },
    { side: 'buy', price: price * (1 + 0.005), trigger: 'above', note: 'Short exit: funding normalized' }
  ]);
  if (closePrev > stop || (entryZ != null && fz < 0)) return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
  return null;
}
