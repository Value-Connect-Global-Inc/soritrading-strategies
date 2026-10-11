/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 BearSized 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 baseline beats buy-and-hold on all three 1d windows,
 * but its worst losses come from breakout whipsaws in bear regimes. This variant keeps the exact
 * same entry/exit rules and only changes SIZE: below the 200-day average it trades at a quarter
 * of full size, so a bear-market whipsaw costs a fraction of the baseline while bull markets keep
 * full size and full gains. A risk rule, not an entry filter — it does not skip the big moves, it
 * just bets far less in the regime where breakouts fail most often.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells when a
 * closed bar closes below the lowest 10 bars, or price falls 2x ATR below entry. Position is
 * quarter size while price is below the 200-day average.
 * When it does NOT work: In a long range where every breakout is a trap it still loses, just less.
 * A violent crash gaps through the ATR stop regardless of size.
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

  const sma200 = ctx.sma(200, 1);
  // Bear regime: price below its 200-day average. Bet a quarter there — bear breakouts fail often.
  const bear = sma200 != null && prevClose < sma200;
  const sizeMult = bear ? 0.25 : 1.0;

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
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
