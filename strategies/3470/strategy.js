/*
 * @coinsori-strategy v1
 * name: Clean Trend Following BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Captures major uptrends in Bitcoin by trading fast vs slow SMA crossovers on daily candles.
 * When it buys and sells: Buys when SMA20 crosses above SMA50. Sells when SMA20 crosses below SMA50.
 * When it does NOT work: Choppy, sideways range-bound markets where moving averages constantly cross, causing whipsaw losses.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  
  const fast1 = ctx.sma(20, 1);
  const fast2 = ctx.sma(20, 2);
  const slow1 = ctx.sma(50, 1);
  const slow2 = ctx.sma(50, 2);
  
  if (fast1 == null || fast2 == null || slow1 == null || slow2 == null) return null;
  
  const pos = ctx.position;
  
  ctx.watch([
    { side: 'buy', price: ctx.price, trigger: 'above', note: 'SMA20/50 Bull Cross' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'SMA20/50 Bear Cross' }
  ]);
  
  // Buy crossover: fast was below or equal slow, now above
  if (pos <= 0 && fast2 <= slow2 && fast1 > slow1) {
    const qty = (ctx.cash / price) * 0.99;
    return { side: 'buy', qty: qty };
  }
  
  // Sell crossover: fast was above or equal slow, now below
  if (pos > 0 && fast2 >= slow2 && fast1 < slow1) {
    return { side: 'sell', qty: pos };
  }
  
  return null;
}
