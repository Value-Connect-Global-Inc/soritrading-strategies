/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Positioning sentiment, not price momentum: on perpetuals, funding is the
 * price longs pay shorts every 8h. When funding is far above its own recent
 * normal, the market is crowded long and a pullback is likely; when it is
 * far below, it is crowded short and a bounce is likely. We fade those
 * extremes.
 * When it buys and sells: SHORT when funding is in its top percentile (crowded
 * long) and SHORT a spike; LONG when funding is in its bottom percentile
 * (crowded short). Exit on a hard ATR stop and when funding reverts to normal.
 * When it does NOT work: in a strong one-way trend (2020-21 bull, 2021 crash)
 * crowded longs/shorts can stay crowded for a long time and fading them gets
 * run over; funding is also noisy on 4h so the percentile must be wide enough
 * to only fire on genuine extremes.
 */
function onUpdate(ctx) {
  const funding = ctx.funding; // current funding rate, null if unavailable
  if (funding == null) { ctx.watch([]); return null; }
  const atr = ctx.atr(14, 1);
  const ema50 = ctx.ema(50, 1);
  if (atr == null || ema50 == null) { ctx.watch([]); return null; }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // Keep a rolling history of funding in ctx.state (restart-safe).
  // funding is 8h-settled; on 4h bars we sample every other bar. Store last ~60 samples.
  let hist = ctx.state.fundingHist || [];
  const lastTs = ctx.state.fundingTs || 0;
  const ts = ctx.times.at(-1) || 0;
  if (ts !== lastTs) {
    hist.push(funding);
    if (hist.length > 60) hist = hist.slice(-60);
    ctx.state.fundingHist = hist;
    ctx.state.fundingTs = ts;
  }
  if (hist.length < 30) { ctx.watch([]); return null; } // need a stable baseline

  // Percentile of the current funding within its own recent history.
  const sorted = hist.slice().sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= funding).length;
  const pct = rank / sorted.length; // 0..1
  const histMean = sorted[Math.floor(sorted.length / 2)];

  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) ctx.state.skipUntil = ctx.i + 6;
  ctx.state.lastPos = pos;

  const alloc = ctx.alloc;
  let forcedRecent = false;
  if (ctx.state._forcedSeen != null && ctx.i - ctx.state._forcedSeen <= 6) forcedRecent = true;
  const afterForced = forcedRecent || (ctx.state.skipUntil != null && ctx.i <= ctx.state.skipUntil);
  const allocOk = (alloc == null || alloc.status === 'ok') && !afterForced;
  if (!allocOk) { ctx.watch([]); return null; }

  const exitOnRevert = Math.abs(funding) < Math.abs(histMean) * 0.6; // funding back to normal = unwind

  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' },
      { side: 'sell', price: ema50, trigger: 'below', note: 'trend break' }
    ]);
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos, reduceOnly: true };
    if (exitOnRevert) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    const stop = (entryPx != null ? entryPx : price) + 3 * atr;
    ctx.watch([
      { side: 'buy', price: stop, trigger: 'above', note: 'ATR stop' },
      { side: 'buy', price: ema50, trigger: 'above', note: 'trend break' }
    ]);
    if (price >= stop) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose != null && prevClose > ema50) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (exitOnRevert) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // Fade extremes: top 10% funding = crowded long -> short; bottom 10% = crowded short -> long.
  const crowdedLong = pct >= 0.90;   // top decile
  const crowdedShort = pct <= 0.10;  // bottom decile
  ctx.watch([
    { side: 'sell', price: price, trigger: 'below', note: 'short crowded long', conds: [{ label: 'funding pct', now: pct, op: '>=', ref: 0.9, closed: true }] },
    { side: 'buy', price: price, trigger: 'above', note: 'long crowded short', conds: [{ label: 'funding pct', now: pct, op: '<=', ref: 0.1, closed: true }] }
  ]);

  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;

  if (crowdedLong) return { side: 'sell', qty };
  if (crowdedShort) return { side: 'buy', qty };
  return null;
}
