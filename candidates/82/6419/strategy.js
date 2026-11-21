/*
 * @coinsori-strategy v1
 * name: BTC EMA200 Regime Long 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends long stretches in strong up-trends and long
 * stretches in bear markets. A 200-bar (33-day) EMA on 4h separates the two:
 * hold BTC while price is above it and capture most of the bull run, then
 * step aside entirely when price falls below it — so a bear market is mostly
 * missed instead of ridden down. This is a regime filter, not a breakout:
 * it is in the market during almost the whole uptrend, which is what makes
 * it competitive with buy-and-hold on the upside.
 * When it buys and sells: buys when price closes above the 200-bar EMA,
 * sells (back to cash) when price closes below it.
 * When it does NOT work: in a long sideways range the price keeps crossing
 * the EMA, so it buys and sells repeatedly and pays fees while going nowhere;
 * a sudden crash can still take a loss before the EMA catches up.
 */
function onUpdate(ctx) {
  const ema = ctx.ema(200, 1);          // 33-day regime line on 4h, closed bar
  if (ema == null) return null;          // warm-up: need 200 bars

  const price = ctx.price;
  const pos = ctx.position || 0;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema, trigger: 'below', note: 'Regime exit EMA200' }]);
    if (price < ema) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  ctx.watch([{ side: 'buy', price: ema, trigger: 'above', note: 'Regime entry EMA200' }]);
  if (price > ema) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  return null;
}
