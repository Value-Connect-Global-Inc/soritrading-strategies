/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 QuietVol Regime 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 baseline beats buy-and-hold on all three 1d windows,
 * but it still enters breakouts while volatility is expanding — those are often exhaustion
 * moves. This variant only buys a 55-day breakout when the market is in a QUIET volatility
 * regime (current ATR below its level ~25 bars ago), so the breakout has room to run before
 * volatility catches up. This filter genuinely changes behavior (unlike range-position filters).
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars AND current
 * ATR is below the ATR from 25 bars ago (calm regime). Sells when a closed bar closes below the
 * lowest 10 bars, or price falls 2x ATR below entry.
 * When it does NOT work: It skips breakouts that start from an already-volatile market, and the
 * holdout window still shows the baseline's bear weakness. A violent crash gaps through the stop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  // Volatility regime filter: only enter when ATR is below its level ~25 bars ago (quiet regime).
  // A breakout from a calm regime has room to run; a breakout during a volatility spike is often
  // the end of the move, not the start. 25 bars = about a month of daily data.
  const atrAgo = ctx.atr(14, 26);
  const quiet = atrAgo != null && atr < atrAgo;
  if (breakout && quiet && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
