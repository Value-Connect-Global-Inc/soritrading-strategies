/*
 * @coinsori-strategy v1
 * name: BNB Pullback-in-Uptrend RSI 4H
 * ex: binance
 * syms: BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The ETH pullback-in-uptrend edge (validated on ETH/USDT 4h)
 *   is applied to BNB/USDT 4h, the asset with the cleanest sustained trends in
 *   this account's history. In a confirmed uptrend (EMA50>EMA200, price above
 *   EMA200), temporary dips below the fast EMA with oversold RSI tend to bounce.
 * When it buys and sells: buys when RSI(14) is below 40 AND price is below
 *   EMA50 while EMA50>EMA200 and price>EMA200. Sells when price closes back
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

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
