/*
 * @coinsori-strategy v1
 * name: DonchianSlowEntry
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the classic Turtle entry (55-day high) still gets whipsawed
 * in choppy markets. Requiring a much longer 90-day high means the breakout must
 * be a genuinely large multi-month move, filtering out the small repeated breakouts
 * that fail. Exit stays tight on a 20-day low so profits are not given back.
 * When it buys and sells: buys full position when the previous close is a new
 * 90-day high; sells when it is a 20-day low, or on a hard 2x ATR stop below entry.
 * When it does NOT work: waiting for a 90-day high means entering later and missing
 * the early part of every move; in a long sideways grind it may trade very rarely
 * and stay in cash while the market drifts.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(90, 2); // 90-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);    // 20-bar low, 2 bars back
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  if (prevClose > entryHigh) {
    // A 90-day high is a much larger breakout than 55-day — fewer, bigger moves.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '90d breakout entry' }]);
  return null;
}
