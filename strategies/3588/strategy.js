/*
 * @coinsori-strategy v1
 * name: Multi-Asset Donchian Turtle Portfolio
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The single-coin Donchian turtle (30-bar breakout entry /
 *   20-bar low exit, SMA200 uptrend gate) was the most robust config in the
 *   ledger on BTC 4h. Running the same proven turtle on a basket of the four
 *   largest liquid coins diversifies across coins that trend at different
 *   times, which smooths the equity curve and reduces the single-coin
 *   bull-market underperformance of any one name.
 * When it buys and sells: on each coin, buys when a closed 4h bar closes above
 *   the highest high of the prior 30 bars while price is above its 200-bar
 *   average (uptrend). Sells on a close below the prior 20-bar low or on a
 *   5x ATR crash stop. Each coin risks a fixed small slice of the account.
 * When it does NOT work: in long sideways ranges breakouts whipsaw and bleed
 *   fees; in a broad crypto bear market all coins fall together, so the basket
 *   cannot diversify away a systemic selloff.
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

  // each coin gets an equal slice of the account; risk 2% of that slice per trade
  const n = Math.max(1, ctx.syms.length);
  const slice = ctx.cash / n;
  const riskCash = slice * 0.02;
  const stopDist = 5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (slice * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;

  const stopPx = price - stopDist;
  ctx.watch([
    { side: 'buy', price: chHigh, trigger: 'above', note: '30-bar breakout' },
    { side: 'sell', price: stopPx, trigger: 'below', note: 'crash stop' }
  ]);
  return { side: 'buy', qty };
}
