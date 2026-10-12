/*
 * @coinsori-strategy v1
 * name: DonchianTrendFiltered
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a
 * new multi-week high and keeps going. Adding a long-term trend filter (close above
 * the 200-day average) keeps the system from buying breakouts inside a downtrend,
 * where they are noise. Classic Turtle momentum with a trend filter.
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high AND above the 200-day trend line; sells on a 20-day low or a hard 2x ATR stop.
 * When it does NOT work: in a sideways market the 55-day high is hit repeatedly and
 * each breakout fails (whipsaw); the filter removes the worst of it but not all.
 * In a steady grind up it also waits for a breakout, so it lags a straight buy-and-hold.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);     // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  const trend = ctx.sma(200, 1);     // long-term trend line, closed bar
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0 || trend == null) return null;
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

  // Trend filter: only breakouts while the close is above the 200-day average.
  // Rationale — a 55-day high inside a downtrend is just noise; above the trend
  // line it is a real regime change. Standard turtle filter, no tuning.
  const uptrend = prevClose > trend;
  if (prevClose > entryHigh && uptrend) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout', conds: [{ label: 'close > SMA200', ok: uptrend }] }]);
  return null;
}
