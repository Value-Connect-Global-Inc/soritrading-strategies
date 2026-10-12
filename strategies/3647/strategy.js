/*
 * @coinsori-strategy v1
 * name: DonchianChandelier
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout — price makes a
 * new multi-week high and keeps going. The classic Turtle entry (55-day high) is kept,
 * but the exit is a Chandelier trailing stop (highest high since entry minus 3x ATR)
 * instead of a 20-day low — a trailing stop locks in more of a long trend and exits
 * on a shallower pullback than waiting for a deep 20-day low.
 * When it buys and sells: buys full position when the previous close is a new 55-day
 * high; sells when price falls 3x ATR below the highest high reached since entry,
 * or on a hard 2x ATR stop below entry (whichever is hit first).
 * When it does NOT work: in a sideways market the 55-day high is hit repeatedly and
 * each breakout fails (whipsaw), and a trailing stop exits on every normal wiggle.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    // Chandelier: trail from the highest high reached since entry.
    let hh = ctx.state.hhSinceEntry;
    if (hh == null || hh < ctx.entryPx) hh = ctx.entryPx;
    if (price > hh) hh = price;
    ctx.state.hhSinceEntry = hh;
    const chandelier = hh - 3 * atr;          // standard Chandelier multiplier, not tuned
    const hardStop = ctx.entryPx - 2 * atr;
    const stop = Math.max(chandelier, hardStop); // exit at whichever stop is higher
    if (price <= stop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'chandelier trail' }]);
    return null;
  }

  if (prevClose > entryHigh) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
