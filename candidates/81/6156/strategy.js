/*
 * @coinsori-strategy v1
 * name: BTC Pure Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for months at a time, and a slow trend ride captures
 * most of those moves while stepping aside in downtrends. A hard stop backs up the trend
 * exit so a sudden gap cannot wipe the account.
 * When it buys and sells: Longs 90% of cash when the 4h close is above its ~66-day average.
 * Sells when the close falls back under the average, or price drops 18% from entry.
 * When it does NOT work: In a long calm bull market it is flat during pullbacks that holding
 * absorbs, so it trails buy-and-hold; in a parabolic bull it gives up part of the upside;
 * and the slow exit means a fast crash can still cost a large drawdown.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 410) { ctx.watch([]); return null; }
  const price = ctx.price;
  const pos = ctx.position || 0;

  // account demoted/returning: no new entries, close any open position in an orderly way
  if (ctx.alloc != null && ctx.alloc.status != null && ctx.alloc.status !== 'ok') {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'Close: account not ok' }]);
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  const sma = ctx.sma(400, 1); // ~66 days on 4h: the medium trend that separates up/down regimes
  if (sma == null) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2); // last CLOSED bar, identical in backtest/live
  if (closePrev == null) { ctx.watch([]); return null; }

  const trendUp = closePrev > sma;
  const entryPx = ctx.entryPx;
  const stopHit = entryPx != null && price < entryPx * 0.82; // hard -18% stop on every position

  if (pos <= 0) {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Long: close above ~66d avg' }]);
    if (trendUp) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: sma, trigger: 'below', note: 'Exit: close under ~66d avg' },
    { side: 'sell', price: entryPx != null ? entryPx * 0.82 : price, trigger: 'below', note: 'Hard -18% stop' }
  ]);
  if (!trendUp || stopHit) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
