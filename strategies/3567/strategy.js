/*
 * @coinsori-strategy v1
 * name: BTC Pullback-in-Uptrend RSI 4H v2 (vol filter)
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The pullback-in-uptrend edge (validated on ETH/BNB/BTC 4h)
 *   is improved with a volatility-regime filter. In a confirmed uptrend
 *   (EMA50>EMA200, price above EMA200), dips below the fast EMA with oversold
 *   RSI tend to bounce — but only when the market is actually moving. In
 *   low-vol sideways chop the dip never bounces and the stop bleeds.
 * When it buys and sells: buys when RSI(14)<40 AND price below EMA50 while
 *   EMA50>EMA200 and price>EMA200, AND recent realized volatility (30-bar avg
 *   absolute move) is above its 150-bar baseline. Sells when price closes back
 *   above EMA50 (mean restored) or on a 2x ATR stop.
 * When it does NOT work: a sustained bear market keeps it flat (good); a low-vol
 *   chop that never bounces is filtered out; but a slow grind-up with shallow
 *   dips may skip valid entries and underperform the plain version.
 */
function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || rsi == null || atr == null) return null;
  const price = ctx.price;

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    // mean restored: price closed back above the fast EMA
    if (price > fp) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    return null;
  }

  // trend intact: fast EMA above slow, price above slow EMA
  if (f <= s) return null;
  if (price <= s) return null;
  // pullback: oversold RSI and price dipped below the fast EMA
  if (rsi >= 40) return null;
  if (price >= f) return null;

  // --- volatility regime filter ---
  // Only take the dip when the market is actually moving: recent 30-bar avg
  // absolute close-to-close move above its 150-bar baseline. Low-vol chop
  // (the documented losing regime) is skipped.
  const closes = ctx.closes;
  let sumShort = 0, sumLong = 0, ok = true;
  for (let k = 1; k <= 150; k++) {
    const c = closes.at(-1 - k);
    const cp = closes.at(-2 - k);
    if (c == null || cp == null) { ok = false; break; }
    const d = Math.abs(c - cp);
    if (k <= 30) sumShort += d;
    sumLong += d;
  }
  if (!ok || sumLong <= 0) return null;
  const avgShort = sumShort / 30, avgLong = sumLong / 150;
  if (avgShort < avgLong) return null; // vol too low — dip unlikely to bounce

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: f, trigger: 'below', note: 'pullback below EMA50', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
    { label: 'EMA50>EMA200', ok: f > s },
    { label: 'vol regime', ok: avgShort >= avgLong }
  ]}]);
  return { side: 'buy', qty };
}
