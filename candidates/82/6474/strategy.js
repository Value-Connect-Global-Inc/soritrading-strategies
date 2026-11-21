/*
 * @coinsori-strategy v1
 * name: ETH Trend Long/Short EMA50 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the exact BTC EMA50/200 long/short core that already
 * validated on BTC 4h (three disjoint windows). ETH trends are similar in
 * character to BTC, so this tests whether the edge is a general crypto
 * trend effect or specific to BTC.
 * When it buys and sells: LONG when EMA50>EMA200 and price pulls back to
 * the 50-EMA (or runs strongly above it while flat). SHORT when EMA50<EMA200
 * and price rallies up to the 50-EMA (or runs strongly below it while flat).
 * Exits on a close through the 200-EMA (regime flip) or a fixed 3xATR stop.
 * After any exit it waits 6 bars before re-entering.
 * When it does NOT work: in a choppy sideways market the 50-EMA is touched
 * repeatedly in both directions, paying fees on small moves; ETH is more
 * volatile than BTC, so the 3xATR stop and the strong-re-entry threshold
 * (SMA400) may behave differently than on BTC.
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

  // cooldown after any exit (ours or a platform forced close): when the
  // position goes non-zero -> zero, wait 6 bars before re-entering
  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) {
    ctx.state.skipUntil = ctx.i + 6;
  }
  ctx.state.lastPos = pos;

  // --- manage an open position ---
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
  if (pos < 0) {
    const stop = (entryPx != null ? entryPx : price) + 3 * atr;
    ctx.watch([
      { side: 'buy', price: ema200, trigger: 'above', note: 'close > EMA200' },
      { side: 'buy', price: stop, trigger: 'above', note: 'ATR short stop' }
    ]);
    if (prevClose != null && prevClose > ema200) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (price >= stop) return { side: 'buy', qty: -pos, reduceOnly: true };
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

  // --- flat: decide direction ---
  const uptrend = ema50 > ema200 && prevClose != null && prevClose > ema200;
  const downtrend = ema50 < ema200 && prevClose != null && prevClose < ema200;
  // pullback = price touches the 50-EMA in the direction of the trend
  const longPull = uptrend && price <= ema50;
  const shortPull = downtrend && price >= ema50;
  // strong re-entry = price running away from the 50-EMA with trend intact
  const longStrong = uptrend && prevClose != null && prevClose > ema50 && prevClose > sma400;
  const shortStrong = downtrend && prevClose != null && prevClose < ema50 && prevClose < sma400;

  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'below', note: 'long pullback', conds: [{ label: 'EMA50>EMA200', ok: uptrend }] },
    { side: 'buy', price: sma400, trigger: 'above', note: 'long re-entry', conds: [{ label: 'EMA50>EMA200', ok: uptrend }] },
    { side: 'sell', price: ema50, trigger: 'above', note: 'short pullback', conds: [{ label: 'EMA50<EMA200', ok: downtrend }] },
    { side: 'sell', price: sma400, trigger: 'below', note: 'short re-entry', conds: [{ label: 'EMA50<EMA200', ok: downtrend }] }
  ]);

  // risk 2% of cash per trade, stop 3xATR away; cap at 99% cash
  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;

  if ((longPull || longStrong) && qty > 0) return { side: 'buy', qty };
  if ((shortPull || shortStrong) && qty > 0) return { side: 'sell', qty };
  return null;
}
