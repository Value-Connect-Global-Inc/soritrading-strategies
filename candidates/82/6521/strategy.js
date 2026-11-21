/*
 * @coinsori-strategy v1
 * name: ETH SMA200 Regime Filter 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-confirmed strategies (slope + vol-sizing) cut
 * drawdown but sit in cash part of the time, so they miss part of a strong
 * bull. This is the simplest possible long/flat regime filter: fully invested
 * whenever price is above its 200-bar (33-day) average, in cash whenever it
 * is below. It captures nearly the whole of an uptrend while stepping aside
 * in sustained downtrends — a different mechanism from the slope-confirmed
 * trend, betting that ETH's 4h price spends long stretches on one side of
 * its long-term average.
 * When it buys and sells: Buy (full size) when the last CLOSED bar closes
 * above the 200-bar average; sell everything when it closes below.
 * When it does NOT work: In a choppy sideways market price crosses the
 * 200-bar average repeatedly, so it whipsaws and pays fees on both sides.
 * It also has no hard stop, so a single sharp crash below the average is
 * taken at full size until the next bar closes.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);      // long-term average (closed bar)
  if (sma == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  // restart-surviving close of a position whose entry price is unknown
  if (pos !== 0 && ctx.entryPx == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    const flag = 'restartClose_' + side;
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    if (ctx.state[flag]) return null;
    ctx.state[flag] = true;
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  // while holding: exit when price closes below the average
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma, trigger: 'below', note: 'below SMA200 exit' }]);
    if (price < sma) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // no new entries while the allocator is not ready
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  // flat: buy at full size when price closes above the average
  if (price > sma) {
    const qty = (ctx.cash / price) * 0.99; // ~all-in, minus fee buffer
    if (qty <= 0) { ctx.watch([]); return null; }
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'above SMA200 entry' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([]);
  return null;
}
