/*
 * @coinsori-strategy v1
 * name: TrendDipBuyer BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In an established uptrend, short pullbacks are buying opportunities —
 * breakout strategies chase new highs while this one buys the dip inside the trend, getting
 * better entries and avoiding the euphoric final leg that breakout buyers often get caught on.
 * When it buys and sells: We buy when price is above its 200-day average (uptrend regime)
 * AND has pulled back at least 7% from the recent 20-day high (a dip, not a breakout). We sell
 * when price closes below the 200-day average (regime broke) or on a hard -20% stop.
 * When it does NOT work: In a long sideways range the 200-day filter flips often and produces
 * whipsaw. In a slow grind-up bull with no 7% pullbacks it stays flat and misses the whole move.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const high20 = ctx.high(20, 1);
  if (sma200 == null || high20 == null) return null;

  const close = ctx.closes.at(-2);              // closed bar
  const uptrend = close > sma200;
  const dip = close <= high20 * 0.93;           // 7% below 20-day high = a real dip, not noise

  if (ctx.position === 0) {
    if (!uptrend || !dip) return null;
    ctx.watch([{ side: 'sell', price: ctx.price * 0.8, trigger: 'below', note: 'stop -20%' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    const stop = entry != null ? entry * 0.8 : null;   // hard stop -20% caps the downside of dip-buying
    const watch = [];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'stop -20%' });
    watch.push({ side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' });
    ctx.watch(watch);
    if (stop != null && ctx.price <= stop) return { side: 'sell', qty: ctx.position };
    if (!uptrend) return { side: 'sell', qty: ctx.position };
  }
  return null;
}
