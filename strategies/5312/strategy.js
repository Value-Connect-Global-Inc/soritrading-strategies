/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto has long persistent bull trends, and a 55-day high breakout
 * catches the start of those trends while a 30-day low break gets you out when they end.
 * When it buys and sells: buys when the daily close makes a new 55-day high; sells when
 * the close breaks below the 30-day low, or price falls 15% below entry as a safety stop.
 * When it does NOT work: long sideways chop whipsaws it (many small losses), and it is
 * always long or flat, so it cannot profit from falling markets.
 */
function onUpdate(ctx) {
  const ENTRY_N = 55;    // breakout lookback in days
  const EXIT_N = 30;     // exit lookback in days
  const STOP_PCT = 0.15; // hard stop: 15% below entry, sized so a stop-out loses 2% of equity
  const RISK = 0.02;     // fraction of equity risked per trade

  // closed-bar values only (ago>=1 is identical in backtest and live)
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const breakoutHigh = ctx.high(ENTRY_N, 2); // highest high of the previous 55 closed bars
  const exitLow = ctx.low(EXIT_N, 2);        // lowest low of the previous 30 closed bars
  if (breakoutHigh == null || exitLow == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const entryPx = ctx.entryPx;

  // ---- EXIT ----
  if (pos > 0) {
    const stopPx = entryPx != null ? entryPx * (1 - STOP_PCT) : null;
    const watch = [{ side: 'sell', price: exitLow, trigger: 'below', note: '30d low exit' }];
    if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: '15% hard stop' });
    ctx.watch(watch);

    if (prevClose < exitLow) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stopPx != null && price <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- ENTRY ----
  ctx.watch([{ side: 'buy', price: breakoutHigh, trigger: 'above', note: '55d high breakout' }]);
  if (prevClose > breakoutHigh) {
    const equity = ctx.cash; // flat, so cash = equity
    const qty = (equity * RISK) / (price * STOP_PCT);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
