/*
 * @coinsori-strategy v1
 * name: BTC Funding Sentiment 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding is a direct measure of how crowded one side of the market is —
 * very positive funding means longs pay shorts (crowded longs), very negative means shorts are crowded.
 * Crowded trades tend to mean-revert. This strategy rides BTC's trend but refuses to enter into a
 * crowded stampede and exits when its own side becomes over-crowded.
 * When it buys and sells: Buy when the last closed 4h close is above a RISING 100-bar SMA and funding
 * is not extremely positive. Sell to flat when the close drops below the SMA or funding gets extremely
 * positive. Short when the close is below a FALLING 100-bar SMA and funding is not extremely negative;
 * cover when the close rises back above the SMA or funding turns extremely negative. A 3x ATR stop
 * closes any losing position in a fast move.
 * When it does NOT work: In a long flat range the SMA crossings churn and each one costs fees. Funding
 * is an 8-hour number that lags the crowd, so a sudden crash with no funding spike is not caught early.
 * If funding stays neutral through a long one-way trend, this behaves like a plain trend follower and
 * gives back gains exactly like holding. Funding only exists on perpetuals, so there is no buy-and-hold
 * comparison for this futures backtest.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(100, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const smaPrev = ctx.sma(100, 5);
  if (smaPrev == null) return null;

  // funding is the 8h perp rate as a fraction. Normal is ~0.0001 (0.01%).
  // 0.0004 = 0.04%/8h (~44%/yr) means longs are clearly crowded; -0.0002 means shorts are crowded.
  // Null = unknown -> treat as not crowded so a trend signal can still trade (like the VIX fallback).
  const funding = ctx.funding;
  const fundLongCrowded = funding != null && funding > 0.0004;
  const fundShortCrowded = funding != null && funding < -0.0002;

  const pos = ctx.position || 0;
  const atr = ctx.atr(14, 1);

  // hard volatility stop both directions: 3x ATR from entry
  if (pos !== 0 && ctx.entryPx != null && atr != null) {
    if (pos > 0) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop long' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    } else {
      const stop = ctx.entryPx + 3 * atr;
      if (prevClose > stop) {
        ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: 'ATR stop short' }]);
        return { side: 'buy', qty: -pos, reduceOnly: true };
      }
    }
  }

  if (pos !== 0) {
    // exits: trend flip, or funding crowding on the side we hold
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'SMA100 exit long' },
      { side: 'buy', price: sma, trigger: 'above', note: 'SMA100 cover short' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'funding crowded long', conds: [{ label: 'funding high', ok: fundLongCrowded }] },
      { side: 'buy', price: prevClose, trigger: 'above', note: 'funding crowded short', conds: [{ label: 'funding low', ok: fundShortCrowded }] }
    ]);
    if (pos > 0 && (prevClose < sma || fundLongCrowded)) return { side: 'sell', qty: pos, reduceOnly: true };
    if (pos < 0 && (prevClose > sma || fundShortCrowded)) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // flat: enter only with the trend AND against the crowded side
  const rising = sma > smaPrev;
  const falling = sma < smaPrev;
  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'long SMA100 up', conds: [{ label: 'funding not crowded', ok: !fundLongCrowded }] },
    { side: 'sell', price: sma, trigger: 'below', note: 'short SMA100 down', conds: [{ label: 'funding not crowded', ok: !fundShortCrowded }] }
  ]);
  if (rising && !fundLongCrowded && prevClose > sma) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  if (falling && !fundShortCrowded && prevClose < sma) {
    return { side: 'sell', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
