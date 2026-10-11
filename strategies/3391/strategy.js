/*
 * @coinsori-strategy v1
 * name: SOL Squeeze Breakout 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto markets alternate between quiet coiling and explosive trends.
 * A squeeze — the Bollinger band (20,2) so narrow it is at a multi-month low — marks the
 * quiet period right before a move. This waits for the squeeze to resolve upward and buys
 * the breakout, betting that a coil releases with force.
 * When it buys and sells: Buys when a closed daily bar has the narrowest BB width in 60 bars
 * AND closes above the highest 20 bars. Sells when a closed bar closes below the lowest 10
 * bars, or price falls 2x ATR below entry.
 * When it does NOT work: In a long sideways range the squeeze resolves downward and every
 * breakout is a trap — it loses, just less than an unfiltered breakout. It also misses
 * steady trend moves that never pause to coil.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 120) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr;
    const channelLow = Math.min(...closes.slice(-12, -2));
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (prevClose < channelLow || price < stop) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Squeeze: current BB width (normalized by price) is the lowest in the last 60 closed bars.
  const bbNow = ctx.bb(20, 2, 1);
  if (bbNow == null) return null;
  const widthNow = (bbNow.upper - bbNow.lower) / prevClose;
  let narrowest = true;
  for (let k = 2; k <= 60; k++) {
    const bb = ctx.bb(20, 2, k);
    if (bb == null) { narrowest = false; break; }
    if ((bb.upper - bb.lower) / closes.at(-1 - k) < widthNow) { narrowest = false; break; }
  }

  const channelHigh = Math.max(...closes.slice(-22, -2));
  const breakout = prevClose > channelHigh;
  if (narrowest && breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
