/*
 * @coinsori-strategy v1
 * name: BTC 200-Day Regime + Loose Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends for months or years at a time. Being long only
 * while price is above its 200-day average keeps the bull-market upside; a wide
 * trailing stop (peak minus 2.5x ATR) only cuts losers, not healthy pullbacks.
 * When it buys and sells: buys whenever the daily close is above the 200-day
 * SMA; sells when the close falls under the trailing stop or back under the SMA.
 * When it does NOT work: in tight sideways chop near the 200-day line it whipsaws
 * and pays fees; a sudden gap can jump through the trailing stop. It never
 * shorts, so it earns nothing in bear markets, and a straight-up bull run that
 * never pulls back beats it because it is flat part of the time.
 */
function onUpdate(ctx) {
  const regN = 200, atrN = 20, mult = 2.5;      // 2.5x ATR: wide enough for bull pullbacks, tight enough to keep gains
  const sma200 = ctx.sma(regN, 1);              // closed-bar regime filter
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const st = ctx.state;

  let stop = null;
  if (pos > 0) {
    if (st.peak == null || st.peak <= 0) {
      st.peak = (ctx.entryPx != null ? ctx.entryPx : prevClose); // survive a restart mid-position
    }
    if (prevClose > st.peak) st.peak = prevClose;
    const atr = ctx.atr(atrN, 1);
    if (atr != null) stop = st.peak - mult * atr;
  }

  const watchList = [];
  if (pos > 0) {
    watchList.push(
      { side: 'sell', price: stop, trigger: 'below', note: 'Wide trailing stop' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'Regime death cross' }
    );
  } else {
    watchList.push({ side: 'buy', price: sma200, trigger: 'above', note: 'Regime up (above 200d SMA)' });
  }
  ctx.watch(watchList);

  if (pos > 0) {
    if (stop != null && prevClose < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos === 0 && prevClose > sma200) {
    st.peak = prevClose;
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty };
  }
  return null;
}
