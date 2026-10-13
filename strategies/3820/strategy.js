/*
 * @coinsori-strategy v1
 * name: BtcDonchianTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's biggest gains come from long sustained trends. A
 * breakout above a 55-day high often starts such a trend (the classic turtle rule),
 * and a break below a 20-day low usually ends it. Requiring price above its 200-day
 * average filters out breakouts that happen inside a long-term downtrend, where
 * bear-market rallies tend to die.
 * When it buys and sells: Buys when price closes above the highest high of the last
 * 55 days AND price is above its 200-day average. Sells when price closes below the
 * lowest low of the last 20 days, with a safety stop of 2x ATR below entry.
 * When it does NOT work: in a long sideways range it gets chopped — each failed
 * breakout is a small loss. It misses the very bottom and top of moves. Long only,
 * so no profit from falling markets.
 */

function onUpdate(ctx) {
  const h55 = ctx.high(55, 1); // highest high of the last 55 closed bars
  const l20 = ctx.low(20, 1); // lowest low of the last 20 closed bars
  const sma200 = ctx.sma(200, 1);
  if (h55 == null || l20 == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  if (pos === 0) {
    // entry: close above the 55-day high = breakout, only in a long-term uptrend
    if (price > h55 && price > sma200) {
      const atr = ctx.atr(14, 1);
      if (atr == null) return null;
      st.entryPx = price;
      st.hi = price;
      // risk 2% of the account on a 2x ATR stop
      const qty = (ctx.cash * 0.02) / (2 * atr);
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  if (price > st.hi) st.hi = price;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  // exit at the 20-day low, but never let the loss exceed 2x ATR from entry
  const hardStop = st.entryPx - 2 * atr;
  const stopPx = Math.max(l20, hardStop);
  ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '20d low / 2xATR stop' }]);
  if (price < stopPx) return { side: 'sell', qty: pos };
  return null;
}
