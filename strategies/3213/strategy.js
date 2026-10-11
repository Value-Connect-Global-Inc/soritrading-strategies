/*
 * @coinsori-strategy v1
 * name: Donchian Breakout BNB 1D
 * ex: binance
 * syms: BNB
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a rising long-term market, a fresh 20-day high breakout often starts a new leg
 * while a 10-day low break ends it — the classic turtle channel system, adapted to crypto.
 * When it buys and sells: buy when price closes above the highest high of the last 20 days, but only
 * while price is above its 200-day average (long-term uptrend). Sell when price closes below the
 * lowest low of the last 10 days.
 * When it does NOT work: in choppy sideways markets breakouts fail and get stopped out repeatedly;
 * in a slow grinding bear market the 200-day gate keeps you out of most trades but the few it takes
 * still lose. Expect whipsaw cost in range-bound regimes.
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const entryN = 20, exitN = 10, trendN = 200;
  // all reads on CLOSED bars (ago=1) so live/backtest behave identically
  const hi = ctx.high(entryN, 1);   // highest high of the last 20 closed bars
  const lo = ctx.low(exitN, 1);     // lowest low of the last 10 closed bars
  const trend = ctx.sma(trendN, 1); // 200-day average
  if (hi == null || lo == null || trend == null) {
    ctx.watch([]);
    return null;
  }

  const px = ctx.price;
  if (ctx.position <= 0) {
    // trend gate: only buy breakouts above the 200-day average (avoids bear-market whipsaw)
    ctx.watch([{
      side: 'buy',
      price: hi,
      trigger: 'above',
      note: '20d high breakout',
      conds: [{ label: 'SMA200 below price', now: trend, op: '<', ref: px, closed: true }],
    }]);
    if (px > hi && px > trend) {
      return { side: 'buy', qty: ctx.cash / px * 0.97 };
    }
    return null;
  }
  ctx.watch([{ side: 'sell', price: lo, trigger: 'below', note: '10d low exit' }]);
  if (px < lo) return { side: 'sell', qty: ctx.position };
  return null;
}
