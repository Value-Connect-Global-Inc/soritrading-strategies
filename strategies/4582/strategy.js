/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto trends hard in both directions, and the biggest
 * gains come from riding a breakout that keeps going. A Donchian channel
 * (N-day high/low) is the classic trend-following trigger: a close above the
 * 55-day high means the market is making new highs and momentum will carry it
 * further; a close below the 20-day low means the trend has broken. This is a
 * pure price-momentum mechanism — no sentiment, no fundamentals.
 * When it buys and sells: buy BTC when the close is above the highest high of
 * the last 55 days. Sell when the close falls below the lowest low of the last
 * 20 days, or when price drops 25% below entry (hard stop).
 * When it does NOT work: in a long sideways range the channel is crossed back
 * and forth and the strategy buys tops and sells bottoms (whipsaw). It also
 * gives back a large share of gains on the way out because the 20-day exit
 * lags the top.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on the position.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Exit: close below the 20-day low = trend broken.
    const low20 = ctx.low(20, 1); // lowest low of the last 20 CLOSED bars
    if (low20 != null && price < low20) return { side: 'sell', qty: pos };
    return null;
  }

  // Entry: close breaks above the highest high of the last 55 CLOSED bars.
  const high55 = ctx.high(55, 1);
  if (high55 == null) return null;
  if (price > high55) {
    // Fixed 95% sizing — matches the proven baseline sizing.
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{ side: 'buy', price: high55, trigger: 'above', note: 'enter: 55d high breakout' }]);
  return null;
}
