/*
 * @coinsori-strategy v1
 * name: Volume-Confirmed Donchian Breakout BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A breakout that happens on clearly above-average volume is far
 * more likely to be a real trend start than a quiet poke through a level. Requiring
 * volume confirmation filters out false breakouts in low-liquidity chop.
 * When it buys and sells: Buy when the daily close makes a new 20-day high AND that
 * day traded at least 1.5x its 20-day average volume. Sell when the close falls below
 * the 10-day low, or below a trailing stop (20-day high minus 2.5x ATR), whichever
 * comes first.
 * When it does NOT work: In a sideways range with occasional volume spikes it still
 * takes several small losses, and it always buys after the first leg of a move because
 * it waits for both a new high and volume confirmation.
 */

function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  const hi20 = ctx.high(20, 2);   // highest high of the 20 bars BEFORE the last closed bar
  const lo10 = ctx.low(10, 1);    // lowest low of the last 10 closed bars
  if (prevClose == null || hi20 == null || lo10 == null) return null;

  const pos = ctx.position || 0;

  if (pos === 0) {
    const avgVol = ctx.avgVol(20);
    const volPrev = ctx.volPrev;
    if (avgVol == null || volPrev == null) return null;
    // Volume confirmation: the breakout day traded at least 1.5x its 20-day average.
    // 1.5x is a moderate bar — high enough to filter quiet pokes, low enough to keep
    // most genuine trend starts.
    const breakout = prevClose > hi20 && volPrev > avgVol * 1.5;
    if (breakout) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: hi20, trigger: 'above', note: 'new 20d high + vol' }]);
    return null;
  }

  const atr = ctx.atr(14, 1);
  const peak = ctx.high(20, 1);
  if (atr == null || peak == null) return null;
  // Fast exit: close below the 10-day low. Hard stop: 2.5x ATR below the 20-day peak.
  const trailStop = peak - 2.5 * atr;
  ctx.watch([
    { side: 'sell', price: lo10, trigger: 'below', note: 'break 10d low' },
    { side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' }
  ]);
  if (prevClose < lo10 || prevClose < trailStop) return { side: 'sell', qty: pos };
  return null;
}
