/*
 * @coinsori-strategy v1
 * name: Donchian Breakout Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's strongest rallies begin when price breaks a multi-week
 * trading range, and the trend then persists for weeks. A Donchian channel flags those
 * breakouts mechanically and rides the trend until price breaks back down.
 * When it buys and sells: Buy when the daily close makes a new 40-day high, but only
 * while price is above its 200-day average (uptrend). Sell when the close breaks below
 * the 20-day low, or when price falls more than 3x the daily range from the highest
 * point reached since entry (ratcheting stop).
 * When it does NOT work: In long sideways markets breakouts fail and reverse, producing
 * repeated small whipsaw losses. It also misses the early part of a new bull market
 * because price must first climb back above the 200-day average.
 */

function onUpdate(ctx) {
  const s = ctx.state || (ctx.state = {});
  const pos = ctx.position || 0;
  const isHolding = pos > 0;

  // Rolling memory of the previous bar's 40-day high / 20-day low.
  if (s.lastBarI !== ctx.i) {
    s.prevHi = s.snapHi ?? null;
    s.prevLo = s.snapLo ?? null;
    s.lastBarI = ctx.i;
  }
  s.snapHi = ctx.high(40);
  s.snapLo = ctx.low(20);
  if (s.prevHi == null || s.prevLo == null) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null) return null;

  // Track entry and highest-touch price for the ratcheting stop.
  if (isHolding && !s.wasHolding) {
    s.highestPx = ctx.price;
    s.wasHolding = true;
  } else if (!isHolding && s.wasHolding) {
    s.highestPx = null;
    s.wasHolding = false;
  }

  if (isHolding) {
    s.highestPx = Math.max(s.highestPx ?? ctx.price, ctx.price);
    // Exit on a 20-day low break, or a 3x ATR pullback from the high, whichever is tighter.
    const channelStop = s.prevLo;
    const atrStop = s.highestPx - 3.0 * atr;
    const stopPx = Math.max(channelStop, atrStop);

    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '20d low / 3ATR stop' }]);
    if (ctx.price <= stopPx) return { side: 'sell', qty: pos };
    return null;
  }

  // Flat: only chase a 40-day breakout above the 200-day average.
  if (ctx.price <= ema200) return null;
  ctx.watch([{ side: 'buy', price: s.prevHi, trigger: 'above', note: '40d breakout' }]);
  if (ctx.price > s.prevHi) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
