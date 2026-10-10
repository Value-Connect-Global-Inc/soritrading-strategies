/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 Trend-Filtered 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: ADA's 55-day breakout with a 10-day channel exit beat buy-and-hold
 * on all three disjoint windows, but the holdout MDD was 70% — the strategy bought
 * breakouts that turned out to be bear-market rallies. The fix has a reason that holds
 * before any results: a breakout below the 200-day EMA is usually a bull trap, so only
 * trade breakouts when the long-term trend is already up (the ledger's promising BTC
 * Donchian uses the same 200d EMA filter).
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars AND
 * above the 200d EMA. Sells when a closed bar closes below the lowest 10 bars, or price
 * falls 2x ATR below entry.
 * When it does NOT work: In a long range above the 200d EMA where every 55d breakout is a
 * trap it still gets chopped. It never shorts, so a multi-year bear is just flat. A violent
 * crash gaps through the ATR stop.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 210) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    // 2x ATR hard stop: a floor stop still caps the worst case if price gaps through the
    // channel low on a crash bar.
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

  // 200d EMA trend filter: only 55d breakouts above the long-term trend. A breakout below
  // it is usually a bear-market rally — this is the bull-trap filter, the whole point.
  const ema200 = ctx.ema(200, 1);
  if (ema200 == null || prevClose <= ema200) return null;

  // 55-bar breakout: EXCLUDE the current closed bar (slice end -2) so prevClose can exceed it.
  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
