/*
 * @coinsori-strategy v1
 * name: ALT 1D Asymmetric Regime Filter (champion recipe)
 * ex: binance
 * syms: BNB/USDT, DOGE/USDT, ETH/USDT, ADA/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: The exact recipe that auto-promoted on XRP daily — slow
 * 50-day entry (few whipsaws) and fast 20-day exit (cut crashes quickly) — as
 * a generalization test on other high-trending alts. The recipe wins where the
 * asset has XRP-like structure: long sustained trends separated by violent
 * crashes. This is a screening version; the symbol is chosen per backtest.
 * When it buys and sells: buys when the daily close crosses back above the
 * 50-day average; sells everything when the close crosses below the 20-day
 * average.
 * When it does NOT work: in a sideways chop around the averages it flips on
 * and off and pays fees; on a volatile alt whose bull markets contain deep
 * normal pullbacks (like SOL's -40% corrections) the fast 20-day exit
 * whipsaws and it misses part of the rise.
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
