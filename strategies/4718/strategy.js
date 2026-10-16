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
 * capitulating — buying that panic and riding the bounce off the mean has been a repeatable
 * edge on BTC.
 * When it buys and sells: buys when the daily close is at least 25% below the 200-day SMA
 * (extreme panic) and the 14-day RSI is below 30 (deep oversold). Sells when price closes
 * back above its 20-day SMA (the bounce has started), or earlier on a hard 3x ATR stop.
 * When it does NOT work: in a slow prolonged bear market price can stay far below the
 * 200-day average for a year (2014-15, 2022) with no sharp bounce — the stop caps the loss
 * but the strategy waits in cash; and during strong bull runs the strategy is simply out
 * of the market, missing the trend entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 220) return null; // need 200-bar SMA + buffer

  const sma200 = ctx.sma(200, 1);
  const sma20 = ctx.sma(20, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma20 == null || rsi == null || atr == null || atr <= 0) return null;

  const prevClose = c.at(-2);
  const pos = ctx.position;

  // Exit first: 3x ATR hard stop, or the bounce has started (close back above 20-day SMA)
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 3;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose > sma20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '3x ATR stop' },
               { side: 'sell', price: sma20, trigger: 'above', note: 'bounce above 20d avg' }]);
    return null;
  }

  // Entry: close 25% below the 200-day SMA (extreme panic) AND RSI < 30 (deep oversold).
  // 25% below the mean is where BTC truly capitulates rather than just dips.
  const deep = prevClose < sma200 * 0.75;
  const oversold = rsi < 30;
  if (!deep || !oversold) {
    ctx.watch([{ side: 'buy', price: sma200 * 0.75, trigger: 'below', note: '25% below 200d avg',
                 conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma200 * 0.75, trigger: 'below', note: '25% below 200d avg',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }]);
  return { side: 'buy', qty };
}
