/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Contrarian sentiment timing on BTC perpetuals using the Crypto Fear &
 * Greed Index (0=extreme fear, 100=extreme greed). Crowd extremes tend to
 * mark short-term turning points. When it buys and sells: LONG when the
 * index is at extreme fear (<20) while price is above the 200-EMA (panic
 * dip in a bull), exit when it recovers above 40 or a hard 3xATR stop.
 * SHORT when the index is at extreme greed (>80) while price is below the
 * 200-EMA (euphoria in a bear), exit when it falls below 60 or the stop.
 * It sits in cash most of the time and only trades crowd extremes.
 * When it does NOT work: in a strong trend the crowd stays extreme for a
 * long time and the contrarian entry gets run over; the daily index also
 * updates only once a day, so a 4h entry can lag the actual turn.
 */
function onUpdate(ctx) {
  const fg = ctx.data('main.fear_greed');
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  // guard every input — a null F&G (dataset not connected) means UNKNOWN, not 0
  if (fg == null || ema200 == null || atr == null) {
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

  // --- manage an open position ---
  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'regime flip' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ]);
    if (fg > 40) return { side: 'sell', qty: pos, reduceOnly: true }; // sentiment back to neutral
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    const stop = (entryPx != null ? entryPx : price) + 3 * atr;
    ctx.watch([
      { side: 'buy', price: ema200, trigger: 'above', note: 'regime flip' },
      { side: 'buy', price: stop, trigger: 'above', note: 'hard stop' }
    ]);
    if (fg < 60) return { side: 'buy', qty: -pos, reduceOnly: true }; // sentiment back to neutral
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
      const lfSec = lf > 1e12 ? lf / 1000 : lf;
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

  // --- flat: contrarian sentiment entry ---
  const uptrend = prevClose != null && prevClose > ema200;
  const downtrend = prevClose != null && prevClose < ema200;
  const panicBuy = uptrend && fg < 20;   // extreme fear in a bull -> buy the panic
  const euphoriaShort = downtrend && fg > 80; // extreme greed in a bear -> fade it

  ctx.watch([
    { side: 'buy', at: 0, note: 'panic buy', conds: [{ label: 'F&G<20', now: fg, op: '<', ref: 20, closed: true }, { label: 'close>EMA200', ok: uptrend }] },
    { side: 'sell', at: 0, note: 'euphoria short', conds: [{ label: 'F&G>80', now: fg, op: '>', ref: 80, closed: true }, { label: 'close<EMA200', ok: downtrend }] }
  ]);

  if (!(panicBuy || euphoriaShort)) return null;
  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  if (panicBuy) return { side: 'buy', qty };
  return { side: 'sell', qty };
}
