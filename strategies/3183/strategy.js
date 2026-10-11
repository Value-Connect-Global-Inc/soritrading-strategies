/*
 * @coinsori-strategy v1
 * name: BTC 4H EMA Trend + ATR Trail
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: EMA20/50 crossover catches 4h trends, but the previous version
 * whipsawed on exits. An ATR trailing stop locks in profits and exits faster on reversals.
 * A long-term trend gate (price above 200-bar SMA) keeps us out of chop.
 * When it buys and sells: Buy on EMA20/50 golden cross when price is above the 200-bar SMA.
 * Sell when the ATR trailing stop is hit (2.5x ATR below highest price since entry).
 * When it does NOT work: In a long bear market the trend gate keeps us mostly in cash
 * (good), but a sharp V-reversal after a bear trap can trigger a false golden cross.
 *
 * 2025-01-15: display-only change — added ctx.watch declarations. Trading logic unchanged.
 */
function onUpdate(ctx) {
  const f = ctx.ema(20, 1), s = ctx.ema(50, 1);
  const fp = ctx.ema(20, 2), sp = ctx.ema(50, 2);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || atr == null) return null;

  // exit via ATR trailing stop: track highest close since entry
  if (ctx.position > 0) {
    const hi = ctx.state && ctx.state.hi ? Math.max(ctx.state.hi, ctx.price) : ctx.price;
    ctx.state.hi = hi;
    // 2.5x ATR trail below the peak
    const stopPx = hi - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR trail stop' }]);
    if (ctx.price < stopPx) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // entry: golden cross + price above long-term trend
  const crossUp = fp <= sp && f > s;
  const trendUp = ctx.price > sma200;
  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'SMA200 trend gate',
    conds: [
      { label: 'EMA20/50 golden cross', ok: crossUp },
      { label: 'SMA200', now: sma200, op: '<', ref: ctx.price, closed: true }
    ]
  }]);
  if (crossUp && trendUp) {
    ctx.state.hi = ctx.price;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
