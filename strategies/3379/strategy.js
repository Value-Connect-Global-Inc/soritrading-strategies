/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/30 Breakout 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ledger's only promising breakout config was ADA Donchian 55/30
 * with a 2.5x ATR hard stop (entry 1881: positive on the holdout window). A 55-day
 * breakout is slow enough to avoid most bull traps, and the 2.5x ATR stop caps the
 * damage when a breakout fails. ADA is not in the user's 5-asset basket, so this adds
 * a genuinely different symbol and family (trend breakout vs the defensive MR basket).
 * When it buys and sells: Buys when a closed bar closes above the highest high of the
 * prior 55 bars. Sells when a closed bar closes below the lowest low of the prior 30
 * bars (channel exit) or price falls 2.5x ATR below entry. No trend filter — the wide
 * breakout channel is the filter.
 * When it does NOT work: In a long range where every 55-day breakout is a bull trap it
 * gets stopped out repeatedly. It never shorts, so a multi-year bear is just flat. A
 * violent crash gaps through the 2.5x ATR stop.
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
    const stop = entry - 2.5 * atr; // 2.5x ATR hard stop — caps failed-breakout damage
    // 30-bar channel exit: EXCLUDE the current closed bar (slice end -2) so prevClose can cross it.
    const channelLow = Math.min(...closes.slice(-32, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3; // brief cooldown to skip immediate re-entry
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // 55-bar breakout: EXCLUDE the current closed bar (slice end -2) so prevClose can exceed it.
  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
