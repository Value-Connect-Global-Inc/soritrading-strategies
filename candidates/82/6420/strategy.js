/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Dip-Buy 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index (0-100) measures crowd mood.
 * Buying extreme fear blindly catches falling knives in bear markets, so this
 * version only buys fear dips while BTC is already in an uptrend (price above
 * its 200-day average) — "buy the dip in a bull market". Fear in an uptrend is
 * a temporary scare; fear in a downtrend is the start of a crash.
 * When it buys and sells: buys when the index is at or below 25, price is above
 * the 200-day SMA, and we are flat; sells when the index reaches 70 (greed), or
 * earlier on a 15% hard stop or a trailing stop that follows the high.
 * When it does NOT work: in a chop where price stays near the 200-day line the
 * trend filter whipsaws; in a long sideways market there are few fear dips so
 * it is flat most of the time and buy-and-hold beats it.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');            // 0-100 crowd sentiment, daily
  const sma200 = ctx.sma(200, 1);               // closed-bar trend line
  if (fg == null || sma200 == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const st = ctx.state;

  // ---- while holding: exits ----
  if (pos > 0) {
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null) {
      if (st.peak == null || prevClose > st.peak) st.peak = prevClose;
    }
    const entry = ctx.entryPx != null ? ctx.entryPx : st.peak;

    let stop = null;
    if (st.peak != null) {
      const atr = ctx.atr(14, 1);
      // 2.5x ATR below the peak: wide enough for bull pullbacks, tight enough to keep gains
      stop = atr != null ? st.peak - 2.5 * atr : null;
    }

    const watchList = [
      { side: 'sell', price: 70, trigger: 'above', note: 'Greed exit (FG>=70)' },
      { side: 'sell', price: entry * 0.85, trigger: 'below', note: 'Hard stop -15%' },
    ];
    if (stop != null) {
      watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'Trailing stop' });
    }
    ctx.watch(watchList);

    if (fg >= 70) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= entry * 0.85) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: dip-buy only in an uptrend ----
  ctx.watch([{ side: 'buy', price: 25, trigger: 'below', note: 'Fear dip entry (FG<=25)' }]);
  if (fg <= 25 && price > sma200) {
    st.peak = ctx.closes.at(-2) != null ? ctx.closes.at(-2) : price;
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
