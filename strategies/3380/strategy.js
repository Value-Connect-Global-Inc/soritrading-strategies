/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 Breakout 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The only breakout config that beat buy-and-hold on all three disjoint
 * 1d windows (cycle 7). Two alternates were tested and REJECTED this cycle: a 200d EMA
 * trend filter cut returns on both dev windows, and a 3x ATR chandelier trail cut the bull
 * window from +927% to +332%. The original 55-day entry with a 10-day channel exit is the
 * best of the three. A 55-day breakout is slow enough to dodge most bull traps, and the
 * 10-day exit cuts losers sooner than a 30-day channel.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells
 * when a closed bar closes below the lowest 10 bars, or price falls 2x ATR below entry.
 * When it does NOT work: In a long range where every 55-day breakout is a trap it gets
 * stopped repeatedly. It never shorts, so a multi-year bear is just flat. A violent crash
 * gaps through the ATR stop.
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
    // 2x ATR hard stop: a floor stop caps the worst case if price gaps through the channel low.
    const stop = entry - 2 * atr;
    // 10-bar channel exit (closed bars): cuts losers sooner than a 30-bar exit.
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // 55-bar breakout, EXCLUDE the current closed bar so prevClose can exceed it.
  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
