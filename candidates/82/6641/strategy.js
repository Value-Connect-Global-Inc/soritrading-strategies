/*
 * @coinsori-strategy v1
 * name: BTC 4H Z-Score Dip Entry Trend Ride
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: A dip in a rising market is a better entry price than
 * waiting for the trend to confirm. This strategy buys when price is far below
 * its own short-term average (a pullback) while the longer 50-day trend is
 * still up, then holds the position until that trend actually breaks. The
 * entry is cheap, the exit is trend-based — so it rides the whole recovery
 * instead of selling the first bounce.
 * When it buys and sells: buys when the 4h close is at least 1.2 standard
 * deviations below its own 100-bar average while the close is above the 50-day
 * average; sells when the close crosses below the 50-day average or on a hard
 * 8% stop-loss.
 * When it does NOT work: in a steady one-way rally with no pullbacks it needs a
 * dip to enter and stays in cash, missing part of the move; in a fast crash the
 * 8% stop still takes a loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma300_1 = ctx.sma(300, 1);
  const z1 = ctx.zscore(100, 1);
  const close1 = ctx.closes.at(-2);
  if (sma300_1 == null || z1 == null || close1 == null || price == null) return null;

  if (ctx.position > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.92 : null;
    const watch = [{ side: 'sell', price: sma300_1, trigger: 'below', note: 'trend broke' }];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' });
    ctx.watch(watch);
    if (close1 < sma300_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([{
    side: 'buy', price: sma300_1, trigger: 'above', note: 'dip in uptrend',
    conds: [{ label: 'z-score(100)', now: z1, op: '<', ref: -1.2, closed: true }]
  }]);
  if (z1 < -1.2 && close1 > sma300_1) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
