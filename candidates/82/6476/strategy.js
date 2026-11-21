/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime SPOT EMA50/200 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Long-only version of the EMA50/200 trend core that validated on
 * BTC/ETH/SOL 4h futures. On SPOT it holds BTC through up-trends and
 * steps aside in down-trends, so it can be compared against buy-and-hold.
 * When it buys and sells: BUY when EMA50>EMA200 and price pulls back to
 * the 50-EMA (or runs strongly above it while flat). SELL (flat) when a
 * close breaks below the 200-EMA (regime flip) or a 3xATR stop is hit.
 * After any exit it waits 6 bars before re-entering. It invests ~95% of
 * cash in the trend (a regime filter must be fully invested to capture
 * the move; the 3xATR stop is the risk control, not position sizing).
 * When it does NOT work: in a choppy sideways market the trend signal
 * whipsaws and fees add up; in a strong bull it can still trail holding
 * if pullback entries miss part of the rise.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || sma400 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // cooldown after any exit (ours or a platform forced close)
  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) {
    ctx.state.skipUntil = ctx.i + 6;
  }
  ctx.state.lastPos = pos;

  // --- manage an open long ---
  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'close < EMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR long stop' }
    ]);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // no new entries right after a platform forced close (edge is reduce-only).
  const alloc = ctx.alloc;
  let forcedRecent = false;
  if (alloc != null && alloc.lastForced != null) {
    const lf = alloc.lastForced;
    if (typeof lf === 'number') {
      const nowT = ctx.times.at(-1) || 0;
      const nowI = ctx.i;
      const lfSec = lf > 1e12 ? lf / 1000 : lf; // ms -> seconds
      if (Math.abs(lfSec - nowT) < 6 * 4 * 3600) forcedRecent = true;
      else if (lf >= nowI - 6 && lf <= nowI) forcedRecent = true;
    } else if (ctx.state._forcedSeen == null) {
      ctx.state._forcedSeen = ctx.i;
    }
  }
  if (ctx.state._forcedSeen != null && ctx.i - ctx.state._forcedSeen <= 6) forcedRecent = true;
  const afterForced = forcedRecent || (ctx.state.skipUntil != null && ctx.i <= ctx.state.skipUntil);
  const allocOk = (alloc == null || alloc.status === 'ok') && !afterForced;
  if (!allocOk) {
    ctx.watch([]);
    return null;
  }

  // --- flat: only consider longs (spot cannot short) ---
  const uptrend = ema50 > ema200 && prevClose != null && prevClose > ema200;
  const longPull = uptrend && price <= ema50;
  const longStrong = uptrend && prevClose != null && prevClose > ema50 && prevClose > sma400;

  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'below', note: 'long pullback', conds: [{ label: 'EMA50>EMA200', ok: uptrend }] },
    { side: 'buy', price: sma400, trigger: 'above', note: 'long re-entry', conds: [{ label: 'EMA50>EMA200', ok: uptrend }] }
  ]);

  // fully invested in the trend: ~95% of cash, stop 3xATR is the exit
  let qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;

  if ((longPull || longStrong) && qty > 0) return { side: 'buy', qty };
  return null;
}
