/*
 * @coinsori-strategy v1
 * name: BTC Fear Greed Capitulation v2 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index measures crowd emotion. Panic days
 * (extreme fear) inside an uptrend are capitulation dips worth buying; the bounce usually
 * carries several weeks. This v2 widens the fear band and rides the recovery with a
 * trailing stop so it participates in more of the move than v1, which only fired on sub-20
 * fear and sat in cash during bulls.
 * When it buys and sells: Buys BTC when the index is at or below 30 AND price is above the
 * 200-day average. Sells on a trailing stop (3 ATR below the best close since entry), or
 * after 45 days. Waits 8 days after any exit before re-buying.
 * When it does NOT work: In a long sideways market with no fear spikes it still rarely
 * trades and lags buy-and-hold. In a bear market the 200-day filter blocks entries but the
 * trailing stop still gives back part of each bounce. No sentiment data before Feb 2018.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || price == null || sma200 == null || atr == null) return null;

  const st = ctx.state;
  const pos = ctx.position;

  if (pos <= 0) {
    if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
    // Fear <=30 is "fear" (not just "extreme fear") — fires more often so it trades in
    // bulls too, not only in once-a-year panics. SMA200 keeps it out of bear markets.
    if (fg <= 30 && price > sma200) {
      st.entryBar = ctx.i;
      st.entryPx = price;
      st.peak = price;
      ctx.watch([{ side: 'sell', price: price - 3 * atr, trigger: 'below', note: '3 ATR trail' }]);
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  if (price > st.peak) st.peak = price;
  const trail = st.peak - 3 * atr;
  const barsHeld = ctx.i - (st.entryBar || ctx.i);
  ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: '3 ATR trail' }]);
  // Trailing stop lets the bounce run; the 45-day cap ends a bounce that has gone stale.
  if (price <= trail || barsHeld >= 45) {
    st.cooldownUntil = ctx.i + 8;
    return { side: 'sell', qty: pos };
  }
  return null;
}
