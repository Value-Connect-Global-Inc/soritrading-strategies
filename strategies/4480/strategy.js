/*
 * @coinsori-strategy v1
 * name: ETH Donchian Breakout
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: ETH tends to make persistent multi-week trends once it breaks out of a long consolidation range. A 50-day-high breakout catches the start of those moves and a 20-day-low exit rides them until the trend actually turns.
 * When it buys and sells: Buys when the daily close breaks above the highest high of the last 50 days. Sells when the close breaks below the lowest low of the last 20 days, or if price drops 2x ATR below entry (hard stop).
 * When it does NOT work: In long sideways chop with no real breakout, the strategy buys late and exits on small 20-day-low breaks, paying many fees (whipsaw). It also misses fast V-shaped reversals because it waits for a daily close.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;

  // Donchian levels from CLOSED bars only (ago=1) so backtest, paper and live all see the same value.
  const upper = ctx.high(50, 1); // highest high of last 50 closed days
  const lower = ctx.low(20, 1);  // lowest low of last 20 closed days
  const atr = ctx.atr(14, 1);    // volatility for the hard stop
  if (upper == null || lower == null || atr == null) return null;

  const pos = ctx.position || 0;
  const stop = ctx.entryPx != null ? ctx.entryPx - 2 * atr : null; // 2x ATR: far enough to survive noise, tight enough to cap loss

  ctx.watch([
    { side: 'buy', price: upper, trigger: 'above', note: '50d high breakout' },
    { side: 'sell', price: lower, trigger: 'below', note: '20d low exit' },
    { side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' }
  ]);

  if (pos <= 0) {
    if (price > upper) {
      const qty = (ctx.cash / price) * 0.99; // leave a little cash for fees
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  if (price < lower) return { side: 'sell', qty: pos };
  if (stop != null && price < stop) return { side: 'sell', qty: pos };
  return null;
}
