/*
 * @coinsori-strategy v1
 * name: Sentiment-Confirmed Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd emotion. A price
 *   breakout that happens while sentiment is already risk-on (index above 50)
 *   is a breakout the crowd believes in; breakouts while sentiment is fearful
 *   more often fail. This replaces the on-chain hashrate confirmation with a
 *   sentiment confirmation to test a different data family.
 * When it buys and sells: buys BTC when a closed daily bar breaks above the
 *   highest high of the prior 20 bars AND the Fear & Greed index is above 50
 *   AND price is above its 200-day average. Sells when price closes below the
 *   200-day average or on a 5x ATR crash stop.
 * When it does NOT work: in a grinding bear market sentiment stays below 50 so
 *   it never buys; in a fast bull market it may already be fully invested and
 *   the breakout confirmation adds little. It can also miss the very start of
 *   a rally before sentiment turns risk-on.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  const chHigh = ctx.high(20, 2);  // highest high of the 20 bars ending 2 bars ago
  if (fg == null || prevClose == null || sma200 == null || chHigh == null) return null;
  const price = ctx.price;

  if (ctx.position > 0) {
    // exit on price trend flip or crash stop — sentiment does NOT force exits
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position };
    const atr = ctx.atr(14, 1);
    const stopPx = atr != null ? ctx.entryPx - 5 * atr : ctx.entryPx * 0.7;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '5x ATR crash stop' }
    ]);
    return null;
  }

  // enter on a 20-bar breakout, confirmed by risk-on sentiment and uptrend
  if (prevClose <= chHigh || prevClose <= sma200 || fg <= 50) return null;

  // risk 2% of the account with a 5x ATR stop, like the proven turtle
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const riskCash = ctx.cash * 0.02;
  const stopDist = 5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  const stopPx = price - stopDist;
  ctx.watch([
    { side: 'buy', price: chHigh, trigger: 'above', note: '20-bar breakout' },
    { side: 'sell', price: stopPx, trigger: 'below', note: '5x ATR crash stop' }
  ]);
  return { side: 'buy', qty };
}
