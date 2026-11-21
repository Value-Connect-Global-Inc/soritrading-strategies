/*
 * @coinsori-strategy v1
 * name: XRP 1D Uptrend Dip-Buy
 * ex: binance
 * syms: XRP/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: In a bull market, pullbacks are usually buying
 * opportunities, not the start of a crash. This strategy buys weakness (close
 * below the 20-day average with RSI below 45) while price is still above its
 * 200-day average — the long-term uptrend regime — and sells when the bounce
 * completes. It is the opposite family from trend-following: it profits from
 * mean reversion inside an uptrend instead of riding the trend. An earlier
 * crash-only version (RSI<30 + below the lower Bollinger band) traded almost
 * never and missed steady bull markets, so the entry was loosened to normal
 * pullbacks.
 * When it buys and sells: buys when the daily close is below the 20-day
 * average, RSI(14) is below 45, and the close is above the 200-day average,
 * with a fixed 50% of cash; sells when the close recovers back above the
 * 20-day average (the bounce is done), or exits on a hard stop 2x ATR below
 * entry.
 * When it does NOT work: in a long bear market price is below the 200-day
 * average so it never buys (misses the bottom); in a falling knife within a
 * bull market the hard stop cuts the loss but the dip keeps falling. In a
 * steady rally that never pulls back to the 20-day average it holds cash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const close1 = ctx.closes.at(-2);
  if (close1 == null || price == null) return null;

  const sma200_1 = ctx.sma(200, 1);
  if (sma200_1 == null) return null;

  if (ctx.position > 0) {
    const sma20_1 = ctx.sma(20, 1);
    const atr1 = ctx.atr(14, 1);
    if (sma20_1 == null || atr1 == null) return null;
    // Bounce is done when the close recovers ABOVE the 20d MA (it was bought
    // below the 20d MA, so it must rise back to complete the bounce).
    const watch = [{ side: 'sell', price: sma20_1, trigger: 'above', note: 'bounce recovered above 20d MA' }];
    let stop = null;
    if (ctx.entryPx != null) {
      stop = ctx.entryPx - 2 * atr1;
      watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(watch);
    if (close1 > sma20_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && close1 < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  const sma20_1 = ctx.sma(20, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma20_1 == null || rsi == null) return null;

  ctx.watch([{ side: 'buy', price: sma20_1, trigger: 'below', note: 'pullback below 20d MA', conds: [
    { label: 'RSI(14) < 45', now: rsi, op: '<', ref: 45, closed: true },
    { label: 'close > 200d MA', ok: close1 > sma200_1 }
  ]}]);
  if (close1 > sma200_1 && rsi < 45 && close1 < sma20_1) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.5 };
  }
  return null;
}
