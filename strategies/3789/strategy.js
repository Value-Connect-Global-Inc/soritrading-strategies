/*
 * @coinsori-strategy v1
 * name: FearGreed Bull Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Retail sentiment (Fear & Greed index) swings to fear at local bottoms and greed at local tops. Buying fear in a confirmed bull market (price above its 200-day average) and selling greed or when the rally reverses captures the best risk/reward.
 * When it buys and sells: Buys when Fear & Greed is fearful (below 40) AND price is above the 200-day average. Sells when the index turns greedy (above 60) or price falls 25% from the highest point since entry (trailing stop — rides a bull dip instead of being stopped out at its bottom).
 * When it does NOT work: In a prolonged bear market price stays below the 200-day average so it stays in cash (misses the eventual bottom). A 25% trailing stop means a fast crash still costs up to 25% before exiting. It gives back part of the rally after selling at greed.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200);
  if (fg == null || sma200 == null) return null;

  const inBull = ctx.price > sma200;

  if (ctx.position <= 0) {
    ctx.state.peak = 0; // reset peak when flat
    if (inBull && fg < 40) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    return null;
  }

  // Track the highest price reached since entry.
  if (ctx.state.peak == null || ctx.price > ctx.state.peak) ctx.state.peak = ctx.price;

  // Exit on greed (take profit) or a 25% trailing stop from the peak (protect gains, ride dips).
  if (fg > 60) return { side: 'sell', qty: ctx.position };
  if (ctx.state.peak > 0 && ctx.price < ctx.state.peak * 0.75) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
