/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed index (0 = extreme fear, 100 = extreme greed) measures crowd sentiment. Crowds are systematically wrong at the extremes: panic selling at extreme fear historically marks good buying zones, euphoria at extreme greed marks tops. This is a sentiment family — different from the trend/mean-reversion/rates families already tested.
 * When it buys and sells: buys when the index is at or below 25 (extreme fear) AND the 100-bar average is still intact (long-term uptrend — avoids buying into a bear market); sells when the index recovers to 60 (greed), when price closes below the 100-bar average, or when price falls 12% below entry (hard stop).
 * When it does NOT work: in a prolonged bear market fear stays extreme for months and the hard stop bleeds repeatedly; in a steady bull market it sits in cash most of the time and misses most of the rise. It is long-only, so a falling market without a fear spike is simply ignored.
 */
function onUpdate(ctx) {
  const fg = ctx.data("main.fear_greed");
  if (fg == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) { ctx.watch([]); return null; }

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: sma100, trigger: 'above', note: 'fear + uptrend',
      conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 25 }]
    }]);
    if (fg <= 25 && prevClose > sma100) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    }
    return null;
  }

  const stopPx = ctx.entryPx == null ? null : ctx.entryPx * 0.88;
  const watch = [
    { side: 'sell', price: sma100, trigger: 'below', note: 'trend broke' },
    { side: 'sell', price: ctx.price, trigger: 'above', note: 'greed exit',
      conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 60 }] }
  ];
  if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' });
  ctx.watch(watch);

  if (fg >= 60) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (prevClose < sma100) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
