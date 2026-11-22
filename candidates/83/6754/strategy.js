/*
 * @coinsori-strategy v1
 * name: BTC Deep-Oversold Bounce 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's sharp sell-offs are usually followed by violent snap-back
 * bounces, so buying the deepest oversold dips inside an intact long-term uptrend is a
 * repeatable edge. This is mean reversion — the opposite of the trend-following that has
 * been struggling on this market.
 * When it buys and sells: Buys when the 2-bar RSI (a fast oversold gauge) closes below 10
 * while price is above a RISING 200-bar trend line. Sells on +5% profit, when the fast RSI
 * recovers above 65, after ~5 days, or on a -7% disaster stop.
 * When it does NOT work: In a slow grinding bear market the trend line is falling so it
 * never buys — safe but idle. In a sudden gap crash the -7% stop is hit before any bounce,
 * so those trades lose the stop amount.
 */
function onUpdate(ctx) {
  const rsi2 = ctx.rsi(2, 1);        // fast oversold gauge, last CLOSED bar
  const sma = ctx.sma(200, 1);       // long-term trend line
  const smaP = ctx.sma(200, 2);
  const closePrev = ctx.closes.at(-2);
  if (rsi2 == null || sma == null || smaP == null || closePrev == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;
  const trendUp = sma > smaP;        // established uptrend

  if (pos > 0) {
    const tp = entryPx != null ? entryPx * 1.05 : 0;   // take +5% profit
    const stop = entryPx != null ? entryPx * 0.93 : 0; // -7% disaster stop
    const barsHeld = ctx.state.entryBar != null ? ctx.i - ctx.state.entryBar : 0;

    ctx.watch([
      { side: 'sell', price: tp, trigger: 'above', note: '+5% target' },
      { side: 'sell', price: stop, trigger: 'below', note: '-7% stop' },
      { side: 'sell', price: ctx.price, trigger: 'above', note: 'RSI recovered', conds: [{ label: 'RSI(2)', now: rsi2, op: '>', ref: 65, closed: true }] },
      { side: 'sell', price: ctx.price, trigger: 'below', note: 'time stop', conds: [{ label: 'bars held', now: barsHeld, op: '>', ref: 30, closed: true }] }
    ]);

    const hitTp = entryPx != null && closePrev >= tp;
    const hitStop = entryPx != null && closePrev <= stop;
    const recovered = rsi2 >= 65;
    const timedOut = barsHeld >= 30; // ~5 days, free up cash for the next dip
    if (hitTp || hitStop || recovered || timedOut) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const dipLow = ctx.low(10, 1);     // recent low = the dip reference shown on the run card
  ctx.watch([{ side: 'buy', price: dipLow, trigger: 'below', note: 'deep dip', conds: [
    { label: 'RSI(2)', now: rsi2, op: '<', ref: 10, closed: true },
    { label: 'SMA200 rising', ok: trendUp, closed: true }
  ]}]);

  if (rsi2 <= 10 && closePrev > sma && trendUp) {
    ctx.state.entryBar = ctx.i;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
