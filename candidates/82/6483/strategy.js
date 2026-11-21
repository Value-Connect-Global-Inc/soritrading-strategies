/*
 * @coinsori-strategy v1
 * name: BTC Trend Gated by VIX Regime 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Macro risk regime, not price momentum: BTC trades like a risk asset, so
 * when equity volatility (VIX) is far above its own recent normal, risk-off
 * is on and BTC tends to fall. We ride the BTC uptrend but refuse to buy
 * into a volatility spike and step aside when fear gets extreme.
 * When it buys and sells: LONG when close is above EMA50 AND the VIX z-score
 * (vs its own recent 30-day history) is below 1.0. Exit on a close below
 * EMA50, a 3xATR stop, or VIX z-score above 2.0 (extreme fear).
 * When it does NOT work: VIX is a US-equity measure with a 2-day lag and
 * crypto has its own drivers (2021 bull, ETF flows) — BTC can rally while
 * VIX is high, and can crash while VIX is calm. It is a gate, not a signal.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  const vix = ctx.data('base_vix');
  if (ema50 == null || atr == null) { ctx.watch([]); return null; }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // Build a rolling buffer of DISTINCT daily VIX values (base_vix is daily,
  // repeats on 4h bars). ~30 distinct days = a stable baseline.
  let buf = ctx.state.vixBuf || [];
  const lastV = ctx.state.vixLast;
  if (vix != null && vix !== lastV) {
    buf.push(vix);
    if (buf.length > 30) buf = buf.slice(-30);
    ctx.state.vixBuf = buf;
    ctx.state.vixLast = vix;
  }

  let vixZ = null;
  if (vix != null && buf.length >= 20) {
    const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
    const sd = Math.sqrt(buf.reduce((a, b) => a + (b - mean) * (b - mean), 0) / buf.length);
    if (sd > 0) vixZ = (vix - mean) / sd;
  }

  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) ctx.state.skipUntil = ctx.i + 6;
  ctx.state.lastPos = pos;

  const alloc = ctx.alloc;
  let forcedRecent = false;
  if (ctx.state._forcedSeen != null && ctx.i - ctx.state._forcedSeen <= 6) forcedRecent = true;
  const afterForced = forcedRecent || (ctx.state.skipUntil != null && ctx.i <= ctx.state.skipUntil);
  const allocOk = (alloc == null || alloc.status === 'ok') && !afterForced;
  if (!allocOk) { ctx.watch([]); return null; }

  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema50, trigger: 'below', note: 'close<EMA50' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'VIX fear', conds: vixZ == null ? [] : [{ label: 'VIX z', now: vixZ, op: '>', ref: 2.0, closed: true }] }
    ]);
    if (vixZ != null && vixZ > 2.0) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const uptrend = prevClose != null && prevClose > ema50;
  const calm = vixZ == null || vixZ < 1.0; // VIX not spiking vs its own recent normal
  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'above', note: 'long', conds: vixZ == null ? [] : [{ label: 'VIX z<1.0', now: vixZ, op: '<', ref: 1.0, closed: true }] }
  ]);
  if (!(uptrend && calm)) return null;

  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
