/*
 * @coinsori-strategy v1
 * name: BTC 4H Funding Crowd Contrarian (usdm)
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding is a direct measure of crowd positioning.
 * When funding is extremely positive, longs are crowded and over-leveraged (a
 * pullback is likely); when extremely negative, shorts are crowded (a bounce is
 * likely). We fade the crowd at the extremes.
 * When it buys and sells: buys (or shorts) when the funding-rate z-score is far
 * from its recent mean (below -1.5 = short crowd, above +1.5 = long crowd).
 * Exits when funding reverts toward neutral (z crosses back through 0) or a
 * 3*ATR hard stop is hit.
 * When it does NOT work: in a strong one-way trend funding can stay extreme for
 * weeks and the fade keeps losing to the trend; funding is noisy and the z-score
 * can whipsaw around the threshold.
 */
function onUpdate(ctx) {
  const f = ctx.funding;
  const price = ctx.price;
  if (f == null || price == null) { ctx.watch([]); return null; }

  // Rolling funding history for a z-score vs its own recent mean (~30 days of 4h bars).
  const arr = ctx.state.fArr || [];
  arr.push(f);
  if (arr.length > 180) arr.shift();
  ctx.state.fArr = arr;

  let fz = null;
  if (arr.length >= 60) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) fz = (f - mean) / sd;
  }
  if (fz == null) { ctx.watch([]); return null; }

  const atr1 = ctx.atr(14, 1);
  const close1 = ctx.closes.at(-2);
  if (atr1 == null || atr1 <= 0 || close1 == null) { ctx.watch([]); return null; }

  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos > 0) {
    // Fixed 3*ATR stop from entry (ratcheted only by entryPx, not trailing) — the
    // contrarian trade is meant to be held until funding reverts, not trailed.
    const stop = ctx.state.longStop != null ? ctx.state.longStop
      : (ctx.entryPx != null ? ctx.entryPx - 3 * atr1 : close1 - 3 * atr1);
    ctx.state.longStop = stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'long stop', conds: [{ label: 'funding z revert', now: fz, op: '>=', ref: 0, closed: true }] }]);
    if (close1 < stop || fz >= 0) { ctx.state.longStop = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    return null;
  }
  if (pos < 0) {
    const stop = ctx.state.shortStop != null ? ctx.state.shortStop
      : (ctx.entryPx != null ? ctx.entryPx + 3 * atr1 : close1 + 3 * atr1);
    ctx.state.shortStop = stop;
    ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: 'short stop', conds: [{ label: 'funding z revert', now: fz, op: '<=', ref: 0, closed: true }] }]);
    if (close1 > stop || fz <= 0) { ctx.state.shortStop = null; return { side: 'buy', qty: -pos, reduceOnly: true }; }
    return null;
  }

  // Flat: half notional keeps a stopped trade to ~3-4% account loss.
  const qty = (ctx.cash / price) * 0.5;
  if (allocOk && fz <= -1.5) {
    ctx.state.longStop = close1 - 3 * atr1;
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'short-crowd buy', conds: [{ label: 'funding z', now: fz, op: '<', ref: -1.5, closed: true }] }]);
    return { side: 'buy', qty: qty };
  }
  if (allocOk && fz >= 1.5) {
    ctx.state.shortStop = close1 + 3 * atr1;
    ctx.watch([{ side: 'sell', price: price, trigger: 'above', note: 'long-crowd short', conds: [{ label: 'funding z', now: fz, op: '>', ref: 1.5, closed: true }] }]);
    return { side: 'sell', qty: qty };
  }
  ctx.watch([]);
  return null;
}
