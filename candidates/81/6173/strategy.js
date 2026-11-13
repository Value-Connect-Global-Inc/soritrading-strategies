/*
 * @coinsori-strategy v1
 * name: BTC 4H EMA200 Trend ATR Trail
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on the 4H chart; the 200-EMA separates
 * uptrends from downtrends and an ATR trailing stop locks in gains.
 * When it buys and sells: buys when price is above the 200-EMA with the 50-EMA
 * above it; sells short in the mirror case; exits when price crosses the 200-EMA
 * or the ATR trailing stop is hit.
 * When it does NOT work: long sideways chop where the 200-EMA and price keep
 * crossing; violent reversals that gap through the trailing stop.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1);
  const emaS = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (emaF == null || emaS == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;
  const mult = 3; // trail width: 3x ATR is wide enough to avoid chop, tight enough to keep gains

  if (pos > 0) {
    // restart-safe: seed the trail from entry when state is missing
    if (st.trailLong == null) st.trailLong = (ctx.entryPx != null ? ctx.entryPx : price) - mult * atr;
    const hi = ctx.high(1);
    if (hi != null) st.trailLong = Math.max(st.trailLong, hi - mult * atr);
    ctx.watch([
      { side: 'sell', price: st.trailLong, trigger: 'below', note: 'ATR trailing stop' },
      { side: 'sell', price: emaS, trigger: 'below', note: 'EMA200 breakdown' }
    ]);
    if (price <= st.trailLong || price < emaS) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    if (st.trailShort == null) st.trailShort = (ctx.entryPx != null ? ctx.entryPx : price) + mult * atr;
    const lo = ctx.low(1);
    if (lo != null) st.trailShort = Math.min(st.trailShort, lo + mult * atr);
    ctx.watch([
      { side: 'buy', price: st.trailShort, trigger: 'above', note: 'ATR trailing stop' },
      { side: 'buy', price: emaS, trigger: 'above', note: 'EMA200 reclaim' }
    ]);
    if (price >= st.trailShort || price > emaS) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // flat: reset trails so a new entry starts fresh from its own entry price
  st.trailLong = null;
  st.trailShort = null;
  ctx.watch([
    { side: 'buy', price: emaS, trigger: 'above', note: 'EMA200 reclaim', conds: [{ label: 'EMA50 > EMA200', ok: emaF > emaS }] },
    { side: 'sell', price: emaS, trigger: 'below', note: 'EMA200 breakdown', conds: [{ label: 'EMA50 < EMA200', ok: emaF < emaS }] }
  ]);
  if (price > emaS && emaF > emaS) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  if (price < emaS && emaF < emaS) {
    return { side: 'sell', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
