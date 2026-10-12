/*
 * @coinsori-strategy v1
 * name: DonchianOiGate
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a price breakout is only trustworthy when it is backed by
 * new positioning in the derivatives market. When open interest is rising above
 * its own average, new money is entering the move — a real trend, not a short
 * squeeze or a one-off pump. Gating the classic Turtle breakout on this OI
 * regime filters out breakouts that lack derivative confirmation.
 * When it buys and sells: buys full position when the previous close is a new
 * 55-day high AND open interest is above its 200-day average; sells on a 20-day
 * low or a hard 2x ATR stop below entry.
 * When it does NOT work: OI data can be delayed or missing, and OI direction
 * is not always a reliable trend signal; in a sideways market breakouts still
 * whipsaw.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
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

  // OI regime gate: open interest above its own 200-day average = new money
  // confirming the breakout. Missing OI passes the gate (no-op) rather than
  // blocking every entry.
  const oi = ctx.binanceOi();
  let gateOn = true;
  if (oi != null && Number.isFinite(oi)) {
    const st = ctx.state;
    if (!st.oiBuf) st.oiBuf = [];
    st.oiBuf.push(oi);
    if (st.oiBuf.length > 200) st.oiBuf.shift();
    if (st.oiBuf.length >= 200) {
      const avg = st.oiBuf.reduce((a, b) => a + b, 0) / st.oiBuf.length;
      gateOn = oi > avg; // rising open interest = new money in the move
    }
  }

  if (prevClose > entryHigh && gateOn) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
