/*
 * @coinsori-strategy v1
 * name: BTC Long-Short Trend 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends long stretches trending in one direction. A slow pair of moving averages tells which way, and this strategy holds a LONG position in uptrends and a SHORT position in downtrends — so it makes money in both bull and bear markets instead of only when prices rise.
 * When it buys and sells: It goes long when the 50-bar average crosses above the 200-bar average, and flips to short when it crosses back below. A wide disaster stop (5x ATR from entry) protects against sudden crashes that outrun the averages. After the platform force-closes a position it waits for the reduce-only window to end before opening a new one.
 * When it does NOT work: In a long sideways market the averages cross back and forth and every flip pays fees. A sudden gap can jump past the stop. When the trend filter is late to flip, it gives back part of a move.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;
  const pos = ctx.position;          // engine truth — may be null when unknown
  const cash = ctx.cash || 0;

  // Allocator gate: while the platform is force-closing or otherwise not 'ok',
  // the edge is reduce-only — never open a NEW position.
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const forceClosed = !!(ctx.alloc && ctx.alloc.lastForced);

  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  const p50 = ctx.ema(50, 2);
  const p200 = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (e50 == null || e200 == null || p50 == null || p200 == null || atr == null) return null;

  const up = e50 > e200;       // current trend, closed bar
  const wasUp = p50 > p200;    // previous trend, closed bar
  const stopDist = 5 * atr;    // disaster stop: 5xATR only catches gaps, the EMA flip is the real exit

  const haveLong = pos != null && pos > 0;
  const haveShort = pos != null && pos < 0;

  // --- Manage an open LONG ---
  if (haveLong) {
    const stop = ctx.entryPx != null ? ctx.entryPx - stopDist : null;
    const watch = [{ side: 'sell', price: e200, trigger: 'below', note: 'trend flip exit' }];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: '5xATR stop' });
    ctx.watch(watch);
    if (!up || (stop != null && price < stop)) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  // --- Manage an open SHORT ---
  if (haveShort) {
    const stop = ctx.entryPx != null ? ctx.entryPx + stopDist : null;
    const watch = [{ side: 'buy', price: e200, trigger: 'above', note: 'trend flip exit' }];
    if (stop != null) watch.push({ side: 'buy', price: stop, trigger: 'above', note: '5xATR stop' });
    ctx.watch(watch);
    if (up || (stop != null && price > stop)) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // --- Flat: only open a NEW position if the allocator allows it ---
  if (!allocOk || forceClosed) {
    // reduce-only window: wait, do not open anything
    ctx.watch([]);
    return null;
  }

  if (wasUp && !up) {
    ctx.watch([{ side: 'sell', price: e200, trigger: 'below', note: 'short entry' }]);
    const qty = (cash / price) * 0.98;   // 1x notional, no leverage
    return { side: 'sell', qty: qty };
  }
  if (!wasUp && up) {
    ctx.watch([{ side: 'buy', price: e200, trigger: 'above', note: 'long entry' }]);
    const qty = (cash / price) * 0.98;   // 1x notional, no leverage
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
