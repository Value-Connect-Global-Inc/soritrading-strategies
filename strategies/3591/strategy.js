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
 *   price; when it is shrinking, miners are capitulating. Combining this
 *   on-chain fundamental with a price uptrend is a different information
 *   source than the price-only turtle already in the portfolio. Hashrate
 *   only confirms entries; price decides exits, so noisy daily hashrate
 *   data cannot churn the position.
 * When it buys and sells: buys BTC when a closed daily bar is above its 200-day
 *   average AND hashrate is above its own 30-day average (recent hashrate
 *   growth). Sells when price closes below the 200-day average or on a 5x ATR
 *   crash stop.
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
  if (hr == null || hrSma == null || prevClose == null || sma200 == null) return null;
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

  // enter only when both price trend and hashrate trend are up
  if (prevClose <= sma200 || hr <= hrSma) return null;

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
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend' },
    { side: 'sell', price: stopPx, trigger: 'below', note: '5x ATR crash stop' }
  ]);
  return { side: 'buy', qty };
}
