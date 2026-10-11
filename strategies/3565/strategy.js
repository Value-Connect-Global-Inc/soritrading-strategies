/*
 * @coinsori-strategy v1
 * name: ETH Pullback-in-Uptrend Trail 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (EMA50>EMA200, price above EMA200),
 *   temporary dips below the fast EMA with oversold RSI tend to bounce. This
 *   buys those dips — mean reversion with a trend filter, the opposite of
 *   momentum chasing.
 * When it buys and sells: buys when RSI(14) is below 40 AND price is below
 *   EMA50 while EMA50>EMA200 and price>EMA200. Sells half when price returns
 *   above EMA50 (locks the bounce), then trails the rest with a 2x ATR stop
 *   so a strong recovery keeps running. A 2x ATR hard stop cuts losers.
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
    // hard stop: the dip kept falling, the bounce thesis is wrong — cut it
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };

    if (price > fp) {
      // mean restored: bank half the bounce, let the rest run with a trailing stop
      if (ctx.state.tookHalf !== true) {
        ctx.state.tookHalf = true;
        const half = ctx.position / 2;
        if (half > 0) return { side: 'sell', qty: half };
      }
      const prevHigh = ctx.state.highestClose || ctx.entryPx;
      const newHigh = Math.max(prevHigh, price);
      ctx.state.highestClose = newHigh;
      const trailStop = newHigh - 2 * atr;
      if (price <= trailStop) return { side: 'sell', qty: ctx.position };
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trailing stop' }]);
      return null;
    }

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
  ctx.state.highestClose = null;
  ctx.state.tookHalf = false;
  return { side: 'buy', qty };
}
