/*
 * @coinsori-strategy v1
 * name: ETH 100D Regime Filter 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: crypto spends long stretches above or below its long-term
 * moving average. Being long only while price is above the 100-day average keeps
 * you in bull markets and out of the worst of bear markets. A 20% trailing stop
 * caps the damage of sudden crashes that the slow average cannot dodge.
 * When it buys and sells: buys when the 4h close crosses above the 100-day
 * average (600 4h bars) while the 25-day average is above it; sells when price
 * falls 20% from the high since entry, or when the close drops back under the
 * 100-day average.
 * When it does NOT work: in a long sideways chop around the average it flips on
 * and off and pays fees; a fast -20% gapping move still gets stopped out near it.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma600_1 = ctx.sma(600, 1);
  const sma600_2 = ctx.sma(600, 2);
  const sma150_1 = ctx.sma(150, 1);
  if (sma600_1 == null || sma600_2 == null || sma150_1 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  const state = ctx.state;

  if (ctx.position > 0) {
    const hi = Math.max(state.hi != null ? state.hi : close1, ctx.highs.at(-2) ?? close1);
    const stop = hi * 0.80; // 20% trailing: survives normal pullbacks, caps crash drawdown
    state.hi = hi;
    const trendFlip = close1 < sma600_1;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: '20% trailing stop' },
      { side: 'sell', price: sma600_1, trigger: 'below', note: 'below 100-day MA' }
    ]);
    if (price <= stop || trendFlip) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Entry: close crossed above the 100-day average with the 25-day average above it.
  ctx.watch([{ side: 'buy', price: sma600_1, trigger: 'above', note: 'above 100-day MA' }]);
  if (close1 > sma600_1 && close2 <= sma600_2 && sma150_1 > sma600_1) {
    state.hi = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
