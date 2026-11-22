/*
 * @coinsori-strategy v1
 * name: BTC 4h Regime Filter Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends long stretches trending up or down; a long-term
 * trend filter keeps us invested during up-trends and steps aside during
 * down-trends, aiming for a return close to holding with a much smaller drawdown.
 * When it buys and sells: buys when price is above a rising 300-bar average
 * (bull regime); sells when price falls below that average (regime turned down)
 * or when a 3x ATR trailing stop is hit (crash protection).
 * When it does NOT work: in long flat/choppy ranges the filter whipsaws and
 * fees eat the small gains; it is long-only, so it never profits from falling
 * prices directly.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(300, 1);
  const smaPrev = ctx.sma(300, 2);
  if (sma == null || smaPrev == null) return null;

  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;
  if (prevClose == null || price == null) return null;

  const inPosition = ctx.position > 0;
  const atr = ctx.atr(14, 1);

  if (inPosition) {
    let hi = ctx.state.hi || prevClose;
    if (prevClose > hi) hi = prevClose;
    ctx.state.hi = hi;

    // trailing stop: 3x ATR below the highest close since entry — room to breathe in
    // a normal pullback, but cuts a real crash before the SMA exit can.
    let stop = null;
    if (atr != null) stop = hi - 3 * atr;

    let exit = null;
    if (stop != null && price < stop) {
      exit = { side: 'sell', qty: ctx.position, reduceOnly: true };
    } else if (prevClose < sma) {
      exit = { side: 'sell', qty: ctx.position, reduceOnly: true };
    }

    const watch = [{ side: 'sell', price: sma, trigger: 'below', note: 'SMA300 regime down' }];
    if (stop != null) watch.unshift({ side: 'sell', price: stop, trigger: 'below', note: '3xATR trailing stop' });
    ctx.watch(watch);
    return exit;
  }

  const uptrend = prevClose > sma && sma > smaPrev;
  ctx.watch([{
    side: 'buy', price: sma, trigger: 'above', note: 'SMA300 regime up',
    conds: [{ label: 'SMA300 rising', ok: sma > smaPrev }]
  }]);
  if (uptrend) {
    ctx.state.hi = prevClose;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
