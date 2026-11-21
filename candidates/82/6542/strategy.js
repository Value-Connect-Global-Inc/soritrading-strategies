/*
 * @coinsori-strategy v1
 * name: BTC Mean-Reversion Dip 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: inside a longer uptrend, sharp selloffs below the 50-bar mean are usually overreactions that snap back. Buying the dip and selling at the mean harvests that snap-back without fighting the trend.
 * When it buys and sells: buys when a 4h bar closes 1.5 standard deviations below its 50-bar mean, but only while price is above the 200-bar EMA (slow trend filter that only steps aside in real bear markets). Sells when price returns to the mean or a 3x ATR stop is hit.
 * When it does NOT work: in a strong bear market the slow trend filter lets it buy a few falling knives; in a dead-flat range it trades small dips for small gains and pays fees.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(50, 1.5, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  const atr = ctx.atr(14, 1);
  if (bb == null || ema200 == null || prevClose == null || atr == null) return null;

  const pos = ctx.position || 0;
  const inUptrend = prevClose > ema200;

  let stop = null;
  if (pos > 0 && ctx.entryPx != null) stop = ctx.entryPx - 3 * atr;

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB50-1.5 dip', conds: [{ label: 'above EMA200', ok: inUptrend, closed: true }] },
    { side: 'sell', price: bb.middle, trigger: 'above', note: 'back to mean' },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }] : [])
  ]);

  // exit: ATR stop
  if (pos > 0 && stop != null && ctx.price <= stop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // exit: back at the mean -> take the snap-back profit
  if (pos > 0 && prevClose > bb.middle) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // entry: 1.5-stdev dip inside a slow uptrend
  if (pos === 0 && inUptrend && prevClose < bb.lower) {
    const qty = (ctx.cash / ctx.price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  return null;
}
