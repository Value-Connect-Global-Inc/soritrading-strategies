/*
 * @coinsori-strategy v1
 * name: BTC Deep-Panic Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price has historically snapped back to its long-run average
 * after panic sell-offs. When price closes far below the 200-day average, the market is
 * capitulating — buying that panic and riding the recovery back to the mean has been a
 * repeatable edge on BTC.
 * When it buys and sells: buys when the daily close is at least 20% below the 200-day SMA
 * (deep panic) and the 14-day RSI is below 35 (oversold). Sells when price closes back
 * above the 200-day SMA, or earlier on a hard 2.5x ATR stop from entry.
 * When it does NOT work: in a prolonged bear market price can stay far below the 200-day
 * average for a year (2014-15, 2022) — the stop caps the loss but the strategy sits in cash
 * waiting; and in a slow grind down without a sharp panic the entry never triggers.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 220) return null; // need 200-bar SMA + buffer

  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || rsi == null || atr == null || atr <= 0) return null;

  const prevClose = c.at(-2);
  const pos = ctx.position;

  // Exit first
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose > sma200) return { side: 'sell', qty: pos }; // mean reverted
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'above', note: 'back above 200d avg' }]);
    return null;
  }

  // Entry: close 20% below the 200-day SMA (deep panic) AND RSI < 35 (oversold).
  // 20% below the mean is where BTC historically capitulates rather than just dips.
  const deep = prevClose < sma200 * 0.80;
  const oversold = rsi < 35;
  if (!deep || !oversold) {
    ctx.watch([{ side: 'buy', price: sma200 * 0.80, trigger: 'below', note: '20% below 200d avg',
                 conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma200 * 0.80, trigger: 'below', note: '20% below 200d avg',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true }] }]);
  return { side: 'buy', qty };
}
