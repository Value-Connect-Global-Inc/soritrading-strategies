/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 Breakout 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ledger's only promising breakout config was ADA Donchian 55/30
 * with a hard ATR stop (entry 1881). A 55-day breakout is slow enough to avoid most bull
 * traps. The exit was the problem: the 30-day channel exit let drawdowns build to 74% on
 * the holdout, and the ATR stop never fired (identical numbers with 1.5x vs 2.5x stop).
 * Speeding the exit to a 10-day channel cuts losers sooner while the 55-day entry still
 * filters out most traps. ADA is not in the user's 5-asset basket, so this adds a
 * genuinely different symbol and family (trend breakout vs defensive MR basket).
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells
 * when a closed bar closes below the lowest 10 bars, or price falls 2x ATR below entry.
 * When it does NOT work: In a long range where every 55-day breakout is a bull trap it
 * gets stopped out repeatedly. It never shorts, so a multi-year bear is just flat. A
 * violent crash gaps through the ATR stop.
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
    // 2x ATR hard stop: the 10-bar channel exit is faster now, but a floor stop still
    // caps the worst case if price gaps through the channel low on a crash bar.
    const stop = entry - 2 * atr;
    // 10-bar channel exit (closed bars): cuts losers much sooner than the old 30-bar exit.
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // 55-bar breakout: EXCLUDE the current closed bar (slice end -2) so prevClose can exceed it.
  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
