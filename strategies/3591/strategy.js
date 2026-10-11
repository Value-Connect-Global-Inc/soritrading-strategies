/*
 * @coinsori-strategy v1
 * name: BTC Hashrate Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Hashrate is the mining network's capacity — when it is
 *   growing (more miners adding machines) it signals confidence in future
 *   price; when it is shrinking, miners are capitulating. Adding this
 *   on-chain fundamental as a confirmation on top of a price breakout entry
 *   filters out breakouts that happen without network conviction.
 * When it buys and sells: buys BTC when a closed daily bar breaks above the
 *   highest high of the prior 20 bars AND hashrate is above its own 30-day
 *   average AND price is above its 200-day average. Sells when price closes
 *   below the 200-day average or on a 5x ATR crash stop.
 * When it does NOT work: hashrate is a slow signal, so it reacts late to sharp
 *   price moves; in a bull market where hashrate lags price it may stay out of
 *   the early rally, and in a bear market it only exits after price has
 *   already fallen a lot.
 */
function onUpdate(ctx) {
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  const chHigh = ctx.high(20, 2);  // highest high of the 20 bars ending 2 bars ago
  if (hr == null || hrSma == null || prevClose == null || sma200 == null || chHigh == null) return null;
  const price = ctx.price;

  if (ctx.position > 0) {
    // exit on price trend flip or crash stop — hashrate does NOT force exits
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

  // enter on a 20-bar breakout, confirmed by hashrate growth and uptrend
  if (prevClose <= chHigh || prevClose <= sma200 || hr <= hrSma) return null;

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
