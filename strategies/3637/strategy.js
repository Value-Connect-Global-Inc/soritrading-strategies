/*
 * @coinsori-strategy v1
 * name: PlainTrendControl
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * CONTROL for the FearGreedTrend experiment — identical trend engine but no
 * fear-greed filter, to measure whether the sentiment overlay adds any value.
 * When it buys and sells: buys when price is above both the 200-day and 50-day
 * averages. Sells when price closes below the 50-day average.
 * When it does NOT work: choppy sideways markets whipsaw it, and it buys into
 * euphoric tops that the filtered version avoids.
 */
function onUpdate(ctx) {
  const s200 = ctx.sma(200, 1);
  const s50 = ctx.sma(50, 1);
  if (s200 == null || s50 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    if (prevClose > s200 && prevClose > s50) {
      return { side: 'buy', qty: (ctx.cash * 0.5) / price * 0.99 };
    }
    return null;
  }

  if (prevClose < s50) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
