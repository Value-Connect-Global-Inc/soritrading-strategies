/*
 * @coinsori-strategy v1
 * name: Sentiment-Zone Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd emotion. Breakouts
 *   that fire while the crowd is neither panicking nor euphoric tend to have
 *   room to run — panic breakouts are falling knives, euphoric breakouts are
 *   tops. Using this sentiment zone as a confirmation on top of a price
 *   breakout filters out breakouts that happen at emotional extremes.
 * When it buys and sells: buys BTC when a closed daily bar breaks above the
 *   highest high of the prior 20 bars AND price is above its 200-day average
 *   AND Fear&Greed is between 25 and 75. Sells when price closes below the
 *   200-day average or on a 5x ATR crash stop.
 * When it does NOT work: in a fast bull market sentiment stays near 80 and the
 *   75 cap keeps it out of the strongest rally; in a grinding bear market
 *   sentiment sits below 25 so it never buys. It also only ever trades on
 *   breakouts, so it can miss slow steady climbs entirely.
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

  // enter on a 20-bar breakout, confirmed by uptrend and non-extreme sentiment
  // (25-75 zone: standard Fear&Greed extreme boundaries — avoid panic knives and euphoric tops)
  if (prevClose <= chHigh || prevClose <= sma200 || fg <= 25 || fg >= 75) return null;

  // risk 2% of the account with a 5x ATR stop, same as the proven turtle
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
