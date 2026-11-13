/*
 * @coinsori-strategy v1
 * name: BTC Long-Short Trend 4H (perp)
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for months in both directions. A slow trend filter is long in
 * uptrends and SHORT in downtrends, so it can make money in a bear market where a long-only
 * strategy (or buy-and-hold) loses. Hard stops cap the loss on every position.
 * When it buys and sells: Longs when the 4h close is above its ~66-day average, shorts when it is
 * below. Reverses on the crossover, or exits on a -18% (long) / +18% (short) move from entry.
 * When it does NOT work: In a choppy sideways market the slow trend flips late and pays fees on
 * whipsaws; funding costs on perps eat into short profits in a bear; and a violent reversal against
 * the position hits the stop for a real loss.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 410) { ctx.watch([]); return null; }
  const price = ctx.price;
  const pos = ctx.position || 0;
  const short = pos < 0;

  // account demoted/returning: close any open position in an orderly way, no new entries
  if (ctx.alloc != null && ctx.alloc.status != null && ctx.alloc.status !== 'ok') {
    if (pos != 0) {
      ctx.watch([{ side: short ? 'buy' : 'sell', price: price, trigger: short ? 'above' : 'below', note: 'Close: account not ok' }]);
      return { side: short ? 'buy' : 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  const sma = ctx.sma(400, 1); // ~66 days on 4h: the medium trend separating up/down regimes
  if (sma == null) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2); // last CLOSED bar, identical in backtest/live
  if (closePrev == null) { ctx.watch([]); return null; }
  const trendUp = closePrev > sma;

  const entryPx = ctx.entryPx;
  const stopHit = entryPx != null && (trendUp ? price < entryPx * 0.82 : price > entryPx * 1.18); // -18% long stop, +18% short stop

  if (pos == 0) {
    ctx.watch([
      { side: 'buy', price: sma, trigger: 'above', note: 'Long: close above ~66d avg' },
      { side: 'sell', price: sma, trigger: 'below', note: 'Short: close below ~66d avg' }
    ]);
    if (trendUp) return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    return { side: 'sell', qty: (ctx.cash / price) * 0.9 };
  }

  // trend reversed: close the position and open the opposite side
  if (trendUp && short) {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Flip to long' }]);
    return [
      { side: 'buy', qty: Math.abs(pos), reduceOnly: true },
      { side: 'buy', qty: (ctx.cash / price) * 0.9 }
    ];
  }
  if (!trendUp && !short) {
    ctx.watch([{ side: 'sell', price: sma, trigger: 'below', note: 'Flip to short' }]);
    return [
      { side: 'sell', qty: Math.abs(pos), reduceOnly: true },
      { side: 'sell', qty: (ctx.cash / price) * 0.9 }
    ];
  }

  // correct side: hold until the hard stop
  ctx.watch([
    { side: short ? 'buy' : 'sell', price: short ? entryPx * 1.18 : entryPx * 0.82, trigger: short ? 'above' : 'below', note: short ? 'Short +18% stop' : 'Long -18% stop' }
  ]);
  if (stopHit) {
    return { side: short ? 'buy' : 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
