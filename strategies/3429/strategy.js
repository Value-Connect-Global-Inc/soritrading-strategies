/*
 * @coinsori-strategy v1
 * name: BTC Trend Momentum 4H
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, strong trends tend to persist. Buying when price is above its long-term average and momentum is positive lets the trend run, while a trailing stop locks in gains.
 * When it buys and sells: Buys when price closes above the 200-SMA and momentum over 20 bars is positive. Sells when price closes back below the 200-SMA or hits a trailing stop at 3×ATR below the highest close since entry.
 * When it does NOT work: Ranging markets without a clear trend — it sits in cash (which is fine) but can whipsaw on the edges of a trend. Sharp V-reversals can gap through the trailing stop, so the stop is not guaranteed.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const prevClose = ctx.closes.at(-2);        // last CLOSED bar
  const prevClose20 = ctx.closes.at(-22);     // 20 closed bars back
  const mom20 = prevClose - prevClose20;      // momentum over 20 closed bars

  // --- exits ---
  if (ctx.position > 0) {
    const stop = ctx.state.stop != null ? ctx.state.stop : (prevClose - 3 * atr);
    if (prevClose < sma200 || prevClose < stop) {
      ctx.state.stop = null;
      ctx.state.high = null;
      return { side: 'sell', qty: ctx.position };
    }
    // ratchet trailing stop up with the highest close since entry
    const high = ctx.state.high != null ? Math.max(ctx.state.high, prevClose) : prevClose;
    ctx.state.high = high;
    ctx.state.stop = high - 3 * atr;          // 3×ATR trailing — wide enough to survive noise, tight enough to protect gains
    return null;
  }

  // --- entry: above long-term trend AND positive momentum ---
  if (prevClose > sma200 && mom20 > 0) {
    ctx.state.high = prevClose;
    ctx.state.stop = prevClose - 3 * atr;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
