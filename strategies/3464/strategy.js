/*
 * @coinsori-strategy v1
 * name: BTC Trend Rider 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: bitcoin spends most of its time in long directional trends. Riding the uptrend while it lasts and letting a volatility-scaled stop cut losses fast avoids both the falling-knife trap and the whipsaw of a fixed tight stop.
 * When it buys and sells: buys when price is above its 50-day average AND the 50-day average is above the 200-day average (full trend alignment). Sells when price falls below 3x ATR(14) under the highest close since entry — a trailing stop that adapts to how volatile the market currently is.
 * When it does NOT work: in a sideways chop market the trend signal flips repeatedly. A sudden crash can gap through the trailing stop, and a V-reversal right after the stop-out is missed.
 */

function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma50 == null || sma200 == null || atr == null) return null;

  if (ctx.position > 0) {
    const hi = ctx.state.hi != null ? Math.max(ctx.state.hi, prevClose) : prevClose;
    ctx.state.hi = hi;
    const stop = hi - 3 * atr;   // trailing stop sized to current volatility (3x ATR)
    if (prevClose <= stop) { ctx.state.lastExit = ctx.i; return { side: 'sell', qty: ctx.position }; }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '3xATR trailing stop' }]);
    return null;
  }

  if (prevClose > sma50 && sma50 > sma200) {
    ctx.state.hi = prevClose;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
