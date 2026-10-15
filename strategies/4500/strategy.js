/*
 * @coinsori-strategy v1
 * name: BuyAndHold CrashFilter BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term trend is strongly up, but it suffers -50% to -80%
 *   crashes. Staying long the whole time captures the up moves; the only way to beat
 *   buy-and-hold is to exit BEFORE the crash and re-enter after it ends.
 * When it buys and sells: Always holds BTC while price is above its 200-day average.
 *   Sells to cash when price closes below the 200-day average (trend broken). Re-buys
 *   when price closes back above it. No other signals.
 * When it does NOT work: It exits late (after the 200-day already broke) so it gives back
 *   part of every crash, and it re-enters late so it misses the first leg of every recovery.
 *   In a long sideways chop around the 200-day it whipsaws. It is a crash-avoidance
 *   strategy, not a return-maximizer.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'close>SMA200 re-entry' }]);
    if (price > sma200) {
      return { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
    return null;
  }

  ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'close<SMA200 crash exit' }]);
  if (price < sma200) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
