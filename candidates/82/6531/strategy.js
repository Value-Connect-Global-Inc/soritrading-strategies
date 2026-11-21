/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price spends long stretches trending either up
 * or down. A single clean trend filter — hold long while price is above its
 * long-term (200-bar) average, step to cash when it falls below — captures
 * most of the up-trends while sitting out the deep bear markets. The key is
 * that the exit is ONLY the trend flip: no hard stop, because a hard stop
 * locks in losses on every dip and then re-enters, churning the account.
 * When it buys and sells: Buys BTC when price closes above the 200-bar
 * average (long-term uptrend confirmed). Sells to cash when price closes
 * below the 200-bar average. No other exit.
 * When it does NOT work: in a long sideways range where price oscillates
 * around the 200-bar average, it flips on and off and pays fees; and it lags
 * the very top of a bull market (the 200-bar average is slow), so it gives
 * back part of the final rally before exiting.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  // long-term trend: price vs 200-bar SMA (use closed bar to avoid look-ahead)
  const trend = ctx.sma(200, 1);
  if (trend == null) { ctx.watch([]); return null; }

  const above = ctx.closes.at(-2) > trend; // closed-bar comparison, no look-ahead

  ctx.watch([
    { side: 'buy', price: trend, trigger: 'above', note: 'trend up -> buy', conds: [{ label: 'close > SMA200', now: ctx.closes.at(-2), op: '>', ref: trend, closed: true }] },
    { side: 'sell', price: trend, trigger: 'below', note: 'trend down -> cash', conds: [{ label: 'close < SMA200', now: ctx.closes.at(-2), op: '<', ref: trend, closed: true }] }
  ]);

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  // exit: holding but trend flipped down
  if (pos !== 0 && !above) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }

  // entry: flat and trend up
  if (pos === 0 && above) {
    const qty = (ctx.cash * 0.95) / price;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
