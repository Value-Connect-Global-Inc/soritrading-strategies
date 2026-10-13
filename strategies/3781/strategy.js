/*
 * @coinsori-strategy v1
 * name: BTC Fed-Liquidity Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: when the Fed keeps its policy rate low, cheap money flows
 *   into risk assets including crypto; when rates are high, money is pulled
 *   out. This bets on the monetary-policy regime rather than short-term price
 *   action, so it is slow and steady — it rides the big liquidity waves.
 * When it buys and sells: buy when the fed funds rate is below 2.5% (loose
 *   policy) and BTC is above its 200-day average (uptrend confirmed). Sell
 *   when the rate rises above 3% (policy turning restrictive) or BTC closes
 *   below its 200-day average, whichever comes first. A 15% floor stop caps
 *   the loss on any single position.
 * When it does NOT work: it misses rallies that start while rates are still
 *   high (the market prices in easing before the Fed acts), and it sits
 *   through the chop of low-rate periods that have no trend. In a high-rate
 *   bear market it simply stays flat and earns nothing.
 */
function onUpdate(ctx) {
  // fed funds rate is the regime driver; use the smoothed series when present.
  const fed = ctx.data('fed_lag30') != null ? ctx.data('fed_lag30')
           : ctx.data('macro_fed_funds') != null ? ctx.data('macro_fed_funds')
           : ctx.data('fed');
  const sma200 = ctx.sma(200, 1);
  if (fed == null || sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // 15% floor stop: one bad regime shift must not sink the account.
    const floorStop = ctx.entryPx != null ? ctx.entryPx * 0.85 : null;
    const stop = floorStop != null ? Math.max(sma200, floorStop) : sma200;
    if (prevClose < stop) return { side: 'sell', qty: ctx.position };
    // policy turning restrictive ends the position regardless of price.
    if (fed > 3.0) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '200d avg / 15% floor' }]);
    return null;
  }

  // 2.5% ≈ the neutral rate: below it policy is accommodative, above it restrictive.
  if (fed > 2.5) return null;
  if (prevClose <= sma200) return null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'trend + loose Fed',
               conds: [{ label: 'Fed funds', now: fed, op: '<', ref: 2.5 }] }]);
  return { side: 'buy', qty: (ctx.cash * 0.99) / ctx.price };
}
