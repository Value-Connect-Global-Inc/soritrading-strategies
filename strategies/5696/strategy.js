/*
 * @coinsori-strategy v1
 * name: BTC Simple SMA20 Crossover 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A plain moving-average crossover to sanity-check that the backtest runner actually fills trades on this data.
 * When it buys and sells: Buys when the previous close crosses above SMA20, sells when it crosses below. Simple test only.
 * When it does NOT work: Not a real strategy — this is a diagnostic.
 */
function onUpdate(ctx) {
  const s20 = ctx.sma(20, 1);
  const s20p = ctx.sma(20, 2);
  if (s20 == null || s20p == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  if (ctx.position > 0) {
    if (prevClose < s20) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (prevClose > s20 && s20p <= prevClose) {
    return { side: 'buy', qty: (0.9 * ctx.cash) / ctx.price * 0.99 };
  }
  return null;
}
