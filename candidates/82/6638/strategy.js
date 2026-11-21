/*
 * @coinsori-strategy v1
 * name: ETH 100D Long-Short Flip 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: crypto spends long stretches above or below its long-term
 * moving average. Staying in the market on both sides — long above the 100-day
 * average, short below it — captures bull markets and profits from bear markets,
 * instead of a long-only filter that just sits out the down-trend.
 * When it buys and sells: goes long when the 4h close is above the 100-day
 * average (600 4h bars), goes short when the close is below it. Position is
 * flipped on the next bar after a regime change; there is no stop, the regime
 * flip is the exit.
 * When it does NOT work: in a long sideways chop around the average it flips
 * back and forth and pays fees on both sides; a sudden gap through the average
 * is entered late.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma600_1 = ctx.sma(600, 1);
  const sma600_2 = ctx.sma(600, 2);
  if (sma600_1 == null || sma600_2 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  // While long: flip to flat when the close falls below the 100-day average.
  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: sma600_1, trigger: 'below', note: 'below 100-day MA' }]);
    if (close1 < sma600_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // While short: cover when the close rises back above the 100-day average.
  if (ctx.position < 0) {
    ctx.watch([{ side: 'buy', price: sma600_1, trigger: 'above', note: 'above 100-day MA' }]);
    if (close1 > sma600_1) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
    return null;
  }

  // Flat: enter with the regime.
  if (close1 > sma600_1 && close2 <= sma600_2) {
    ctx.watch([{ side: 'buy', price: sma600_1, trigger: 'above', note: 'trend up' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  if (close1 < sma600_1 && close2 >= sma600_2) {
    ctx.watch([{ side: 'sell', price: sma600_1, trigger: 'below', note: 'trend down' }]);
    return { side: 'sell', qty: (ctx.cash / price) * 0.99 };
  }

  ctx.watch([]);
  return null;
}
