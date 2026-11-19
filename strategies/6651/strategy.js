/*
 * @coinsori-strategy v1
 * name: XRP 1D Regime Filter Crash-Exit
 * ex: binance
 * syms: XRP/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: Buy-and-hold makes the full bull but also rides every
 * crash down. This strategy stays invested almost all the time (so it captures
 * the whole uptrend) but steps out to cash when the market turns down, then
 * re-enters when it turns back up. Same upside as holding, much smaller
 * drawdown. The regime filter is asymmetric: it enters on the slow 50-day
 * cross (few whipsaws) and exits on the faster 20-day cross — so a failed
 * bounce in a grinding bear is cut quickly instead of ridden all the way down,
 * while in a strong bull price stays above the 20-day and the trend is held.
 * When it buys and sells: buys when the daily close crosses back above the
 * 50-day average; sells everything when the close crosses below the 20-day
 * average. Position is a fixed 99% of cash.
 * When it does NOT work: in a sideways chop it flips on and off and pays fees;
 * a fast crash that gapes through the 20-day average still takes a hit before
 * the exit fires; in a slow grinding bear where price hugs the 20-day average
 * it can re-enter into the decline.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma50_1 = ctx.sma(50, 1);
  const sma50_2 = ctx.sma(50, 2);
  if (sma50_1 == null || sma50_2 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  if (ctx.position > 0) {
    const sma20_1 = ctx.sma(20, 1);
    if (sma20_1 == null) return null;
    ctx.watch([{ side: 'sell', price: sma20_1, trigger: 'below', note: 'crash: below 20d MA' }]);
    if (close1 < sma20_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma50_1, trigger: 'above', note: 'back above 50d MA' }]);
  if (close1 > sma50_1 && close2 <= sma50_2) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
