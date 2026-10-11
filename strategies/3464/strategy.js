/*
 * @coinsori-strategy v1
 * name: BTC Trend Rider 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: bitcoin spends most of its time in long directional trends (up or down). Riding the uptrend while it lasts and cutting losses fast avoids the mean-reversion trap of trying to catch falling knives.
 * When it buys and sells: buys when price is above its 50-day average AND the 50-day average is above the 200-day average (full trend alignment). Sells when price breaks below the 50-day average or hits a -15% hard stop.
 * When it does NOT work: in a sideways chop market the trend signals flip frequently and the -15% stop on each entry bleeds the account. It also misses sharp V-recoveries after a trend break.
 */

function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  if (sma50 == null || sma200 == null) return null;

  if (ctx.position > 0) {
    const stopPx = ctx.state.stopPx != null ? ctx.state.stopPx : ctx.entryPx * 0.85;
    if (prevClose <= stopPx) { ctx.state.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    if (prevClose < sma50) { ctx.state.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '-15% stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend break' }]);
    return null;
  }

  if (prevClose > sma50 && sma50 > sma200) {
    ctx.state.stopPx = ctx.price * 0.85;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
