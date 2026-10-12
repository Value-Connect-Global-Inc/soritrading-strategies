/*
 * @coinsori-strategy v1
 * name: DipRiderTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a strong uptrend, BTC pulls back sharply and then resumes.
 * Breakout systems buy the top of each leg and get stopped out on the pullback.
 * This strategy buys the dip instead: it enters when price touches its 20-day
 * average while staying above its 200-day average, and exits only when the trend
 * actually breaks (50-day low) or on a hard stop.
 * When it buys and sells: buys when the last close is at/below the 20-day EMA and
 * price is above the 200-day SMA; sells on a 50-day low or a 2x ATR stop below entry.
 * When it does NOT work: in a sustained bear market the 200-day filter keeps it in
 * cash, but if a bear begins while it is long it gives back the move; it also
 * underperforms pure buy-and-hold if the bull has almost no pullbacks.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const pos = ctx.position;

  if (pos > 0) {
    const exitLow = ctx.low(50, 2); // 50-bar low, 2 bars back (excludes last closed bar)
    const atr = ctx.atr(14, 1);
    if (exitLow == null || atr == null || atr <= 0) return null;
    const prevClose = ctx.closes.at(-2);
    if (prevClose == null) return null;
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  if (ema20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Uptrend + last close dipped to the 20-day average = buy the dip, not the breakout.
  if (price > sma200 && prevClose <= ema20) {
    ctx.watch([{ side: 'sell', price: null, trigger: 'below', note: 'hold while trend intact' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: ema20, trigger: 'below', note: 'pullback to 20d EMA' }]);
  return null;
}
