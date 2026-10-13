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
 * and a break below a 20-day low usually ends it. Following these channels rides the
 * big moves and cuts losses quickly when a breakout fails.
 * When it buys and sells: Buys when price closes above the highest high of the last
 * 55 days. Sells when price closes below the lowest low of the last 20 days, with a
 * safety stop of 2x ATR below the entry price.
 * When it does NOT work: in a long sideways range it gets chopped — each failed
 * breakout is a small loss. It misses the very bottom and top of moves (that is the
 * price of trend-following). Long only, so no profit from falling markets.
 */

function onUpdate(ctx) {
  const h55 = ctx.high(55, 1); // highest high of the last 55 closed bars
  const l20 = ctx.low(20, 1); // lowest low of the last 20 closed bars
  if (h55 == null || l20 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  if (pos === 0) {
    // entry: close above the 55-day high = breakout
    if (price > h55) {
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
