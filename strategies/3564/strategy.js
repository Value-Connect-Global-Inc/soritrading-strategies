/*
 * @coinsori-strategy v1
 * name: SOL Pullback-in-Uptrend RSI 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Generalization test of the validated ETH pullback family
 *   (3563) onto SOL, which has stronger mean-reversion behavior. If the family
 *   edge is real it should hold here too, not just on ETH.
 * When it buys and sells: buys when RSI(14) is below 40 AND price is below
 *   EMA50 while EMA50>EMA200 and price>EMA200. Sells when price crosses back
 *   above EMA50 (mean restored), or on a 2x ATR stop.
 * When it does NOT work: strong bear markets keep it flat (good), but low-vol
 *   sideways chop means the dip never bounces and it bleeds via the stop.
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
    if (fp != null && price > fp) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    return null;
  }

  // trend intact: fast EMA above slow EMA, price above slow EMA
  if (f <= s) return null;
  if (price <= s) return null;
  // pullback: oversold RSI and price dipped below the fast EMA
  if (rsi >= 40) return null;
  if (price >= f) return null;

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
