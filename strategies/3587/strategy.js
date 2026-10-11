/*
 * @coinsori-strategy v1
 * name: BTC 4H Donchian Turtle Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following with Donchian channels — buy breakouts to
 *   new highs and ride the move until price breaks down. On BTC 4h this was the
 *   most robust config in the ledger: positive on all three disjoint 2.3-year
 *   windows (+230% / +63% / +2.9%), beating buy-and-hold on the middle one.
 * When it buys and sells: buys when a closed 4h bar closes above the highest
 *   high of the prior 30 bars, but only while price is above its 200-bar
 *   average (uptrend). Sells when a closed bar closes below the lowest low of
 *   the prior 20 bars, or if price falls 5x ATR below entry (crash stop).
 * When it does NOT work: in long sideways ranges the breakout whipsaws and
 *   bleeds fees without progress; long-only means a sustained bear market is
 *   mostly flat. The 20-bar exit gives back part of every winner.
 */
function onUpdate(ctx) {
  // closed-bar values (ago>=1): identical in backtest, paper and live
  const prevClose = ctx.closes.at(-2);
  const chHigh = ctx.high(30, 2);   // highest high of the 30 bars ending 2 bars ago
  const chLow = ctx.low(20, 2);     // lowest low of the 20 bars ending 2 bars ago
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (prevClose == null || chHigh == null || chLow == null || sma200 == null || atr == null) return null;
  const price = ctx.price;

  if (ctx.position > 0) {
    // crash stop: 5x ATR below entry — wide on purpose, catastrophic-risk only
    const stopPx = ctx.entryPx - 5 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    if (prevClose < chLow) return { side: 'sell', qty: ctx.position };
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'crash stop' },
      { side: 'sell', price: chLow, trigger: 'below', note: '20-bar low exit' }
    ]);
    return null;
  }

  // enter only in an uptrend (price above 200-bar average) on a 30-bar breakout
  if (prevClose <= chHigh || prevClose <= sma200) return null;

  // risk 2% of cash per trade, stop distance 5x ATR -> position size
  const riskCash = ctx.cash * 0.02;
  const stopDist = 5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;

  const stopPx = price - stopDist;
  ctx.watch([
    { side: 'buy', price: chHigh, trigger: 'above', note: '30-bar breakout' },
    { side: 'sell', price: stopPx, trigger: 'below', note: 'crash stop' }
  ]);
  return { side: 'buy', qty };
}
