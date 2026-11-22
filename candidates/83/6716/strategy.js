/*
 * @coinsori-strategy v1
 * name: BTC 200-Day Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's biggest profits come in long multi-month uptrends and its worst
 * losses in long multi-month downtrends. The 200-day average separates the two regimes: staying
 * invested only while price is above it keeps the gains of bull markets and sits in cash through
 * bear markets. This is a slow, simple rule with almost no trading cost.
 * When it buys and sells: buys when the daily close moves back above the 200-day average; sells
 * when the daily close falls back below it. No leverage, no intraday churn.
 * When it does NOT work: years of sideways chop around the 200-day average cause repeated whipsaw
 * losses, and after a sharp top the strategy still gives back part of the peak before the 200-day
 * average confirms the turn (e.g. it exits only well below the top).
 */
function onUpdate(ctx) {
  // 200-day average from CLOSED bars (ago=1) so backtest/paper/live behave identically
  const sma = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position || 0;
  const price = ctx.price;

  if (pos > 0) {
    // in the market: sell as soon as the daily close falls back below the 200-day average
    ctx.watch([{ side: 'sell', price: sma, trigger: 'below', note: 'below 200d MA' }]);
    if (prevClose < sma) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat: buy as soon as the daily close moves back above the 200-day average
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'above 200d MA' }]);
  if (prevClose > sma) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
