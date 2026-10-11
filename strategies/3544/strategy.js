/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd sentiment extremes on the Crypto Fear & Greed Index are
 * contrarian signals — when everyone is terrified (index very low), price is often
 * near a bottom; when everyone is euphoric (index very high), price is often near a top.
 * When it buys and sells: Buys when flat AND index <= 25 (extreme fear) AND price is
 * not in a deep downtrend (above its 200-day average). Takes profit at index >= 75
 * (extreme greed). Hard 3-ATR stop to cap any single loss.
 * When it does NOT work: In a persistent bear market the index stays low for months
 * and each buy is a falling knife. In a slow grind the index rarely hits extremes so
 * it sits in cash. Data starts 2018; the 2017 window has no fear&greed data.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');

  // ---- exit ----
  if (ctx.position > 0) {
    if (atr == null) return null;
    const stopPx = ctx.entryPx - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    // extreme greed = take profit. Contrarian exit on euphoria.
    if (fg != null && fg >= 75) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '3 ATR stop' },
               { side: 'sell', price: null, note: 'FG>=75 take profit', conds: [{ label: 'FearGreed', now: fg, op: '>=', ref: 75, closed: true }] }]);
    return null;
  }

  // ---- entry only when flat ----
  // trend filter: only buy above the 200-day average — extreme fear in a bear is a
  // falling knife, not a bottom.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || price < sma200) return null;
  // contrarian entry at extreme fear
  if (fg == null || fg > 25) {
    ctx.watch([{ side: 'buy', price: null, note: 'FG<=25', conds: [{ label: 'FearGreed', now: fg, op: '<=', ref: 25, closed: true }] }]);
    return null;
  }

  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
