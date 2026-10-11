/*
 * @coinsori-strategy v1
 * name: Fed Regime BTC 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Fed funds rate is a slow, powerful driver of risk appetite. When the Fed is cutting rates, liquidity flows into risk assets like BTC; when it is hiking, risk assets struggle. We only hold BTC during easing regimes with an uptrend confirmed.
 * When it buys and sells: buys when the Fed funds rate is below where it was 30 days ago (easing) AND price is above its 200-day average. Sells when price breaks below the 200-day average or hits a -15% stop.
 * When it does NOT work: during Fed pauses (no easing signal) the filter gives no edge. In a stagflation bear market with a dovish Fed the trend gate fails. The filter is slow, so expect long flat periods and occasional whipsaw.
 */

function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fed == null || fedLag == null) return null;
  const easing = fed < fedLag;   // Fed cutting = risk-on regime; hiking = stay out.

  if (ctx.position > 0) {
    const stopPx = ctx.state.stopPx != null ? ctx.state.stopPx : ctx.entryPx * 0.85;
    if (prevClose <= stopPx) { ctx.state.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    if (prevClose < sma200) { ctx.state.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '-15% stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }]);
    return null;
  }

  if (easing && prevClose > sma200) {
    ctx.state.stopPx = ctx.price * 0.85;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
