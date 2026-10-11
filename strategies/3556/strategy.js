/*
 * @coinsori-strategy v1
 * name: BNB Trend-Follow EMA50/200 4H
 * ex: binance
 * syms: BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The EMA50/200 crossover trend core was validated on ETH 4h
 *   (+36/+260/+35/+54 across four disjoint windows). This is a generalization test:
 *   the same core, no new parameters, on a different large-cap asset (BNB) — if the
 *   family edge is real it should not depend on the symbol.
 * When it buys and sells: buys when the fast EMA crosses above the slow EMA while
 *   price is above the long-term SMA200 (uptrend filter). Sells on the death cross
 *   (EMA50 below EMA200) or a hard 2.5x ATR stop.
 * When it does NOT work: in choppy sideways ranges the crossover whipsaws and fees
 *   eat the account, and a sustained bear market produces flat-to-loss results
 *   (long-only). If the edge is symbol-specific this test shows it.
 */
function onUpdate(ctx) {
  // closed-bar values so backtest, live and paper agree
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || atr == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    // hard stop at 2.5x ATR below entry — the sizing risk is real, not assumed
    const stopPx = ctx.entryPx - 2.5 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    // trend-change exit: EMA50 crosses below EMA200
    if (fp > sp && f <= s) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    return null;
  }

  // entry: bullish crossover + price above SMA200 (long-term uptrend)
  if (fp <= sp && f > s && prevClose > sma200) {
    // size so the 2.5x ATR stop loses ~2% of cash (can't ruin account)
    const riskCash = ctx.cash * 0.02;
    const stopDist = 2.5 * atr;
    let qty = stopDist > 0 ? riskCash / stopDist : 0;
    const maxQty = (ctx.cash * 0.99) / price;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }
  return null;
}
