/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding is a crowd-positioning meter. When funding is
 * strongly negative, shorts pay longs — the crowd is short and a squeeze is likely; when
 * strongly positive, the crowd is long and vulnerable. This fades the crowd (contrarian),
 * but only in the direction of the 200-bar trend so it never catches a falling knife.
 * When it buys and sells: long when funding is ~1.5 std below its own recent mean
 * (crowded short) while price is above the 200 EMA; short when funding is ~1.5 std above
 * its mean (crowded long) while price is below the 200 EMA. Exit when the funding signal
 * fades back to normal or a 2.5x ATR stop is hit.
 * When it does NOT work: in calm markets funding rarely goes extreme, so it trades little;
 * in a one-way crash funding can stay extremely negative while price keeps falling (shorts
 * keep winning) and the contrarian long loses until the stop fires.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const f = ctx.funding;
  if (ema200 == null || atr == null || f == null) { ctx.watch([]); return null; }
  const close = ctx.closes.at(-2);

  // Funding history: use the z-score of current funding vs its own recent mean (relative
  // shape), not a fixed level — funding scale changes with regime.
  const st = ctx.state;
  st.fHist = st.fHist || [];
  st.fHist.push(f);
  if (st.fHist.length > 360) st.fHist.shift();

  let fz = 0;
  if (st.fHist.length >= 90) { // 90 bars = 15 days of funding history
    const w = st.fHist.slice(-90);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) * (b - mean), 0) / w.length) || 1e-9;
    fz = (f - mean) / sd;
  } else {
    ctx.watch([]);
    return null;
  }

  const up = close > ema200;
  const down = close < ema200;

  // ---- exits ----
  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
    const fade = fz > 0.5; // crowd no longer short → squeeze thesis gone
    if (fade || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'fade/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '2.5x ATR stop' }]);
    return null;
  }
  if (pos < 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx + 2.5 * atr : null;
    const fade = fz < -0.5;
    if (fade || (stop != null && close > stop)) {
      ctx.watch([{ side: 'buy', price: stop != null ? stop : close, trigger: 'above', note: 'fade/stop exit' }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'buy', price: stop != null ? stop : close, trigger: 'above', note: '2.5x ATR stop' }]);
    return null;
  }

  // ---- entries: fade extremes only in the direction of the trend ----
  if (fz < -1.5 && up) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'crowded-short long', conds: [{ label: 'funding z', now: fz, op: '<', ref: -1.5, closed: true }] }]);
    return { side: 'buy', qty: qty };
  }
  if (fz > 1.5 && down) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'sell', price: close, trigger: 'below', note: 'crowded-long short', conds: [{ label: 'funding z', now: fz, op: '>', ref: 1.5, closed: true }] }]);
    return { side: 'sell', qty: qty };
  }

  ctx.watch([]);
  return null;
}
