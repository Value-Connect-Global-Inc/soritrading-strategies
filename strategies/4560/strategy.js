/*
 * @coinsori-strategy v1
 * name: RSI2 Mean Reversion ETH 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: short, sharp pullbacks inside an established uptrend tend to snap back quickly (mean reversion of a 2-period RSI), and ETH has produced many such days.
 * When it buys and sells: buy when the 2-day RSI closes below 10 AND price is above the 200-day average (uptrend intact). Sell when the 2-day RSI recovers above 50, or the -15% hard stop hits.
 * When it does NOT work: in a persistent bear market the 200-day filter keeps us out, but a fast crash can still stop us out at -15%. Flat sideways chop produces few signals.
 */
function onUpdate(ctx) {
  const r2 = ctx.rsi(2, 1);          // closed bar RSI(2)
  const r2prev = ctx.rsi(2, 2);      // bar before, to detect a fresh cross
  const sma200 = ctx.sma(200, 1);    // closed bar 200-day average
  const price = ctx.price;
  if (r2 == null || r2prev == null || sma200 == null) return null;

  // entry — deep oversold (RSI2 < 10) but only inside a longer uptrend
  if (ctx.position <= 0) {
    if (price > sma200 && r2 < 10 && r2prev >= 10) {
      ctx.watch([{ side:'sell', price: price * 1.06, trigger:'above', note:'target' },
                 { side:'sell', price: price * 0.85, trigger:'below', note:'hard stop' }]);
      return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
    }
    ctx.watch([{ side:'buy', price: sma200, trigger:'above', note:'uptrend confirm' }]);
    return null;
  }

  // exit conditions while holding
  const stop = ctx.entryPx == null ? null : ctx.entryPx * 0.85;
  ctx.watch([{ side:'sell', price: null, trigger:'above', note:'RSI2 recovery to 50' },
             { side:'sell', price: stop, trigger:'below', note:'hard stop -15%' }]);
  if (r2 >= 50 || (stop != null && price <= stop)) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
