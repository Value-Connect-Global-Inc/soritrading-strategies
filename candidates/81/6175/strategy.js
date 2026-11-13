/*
 * @coinsori-strategy v1
 * name: BTC 4H SMA200 Regime Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly; while price stays above its 200-period
 * (about 33 days on 4H) moving average the trend is up, and being long only then
 * keeps most of the upside while stepping aside in downtrends. A hard stop below
 * entry caps the damage when a crash gaps far below the SMA200 before the filter
 * can react.
 * When it buys and sells: buys when the last closed bar is above the SMA200 and
 * it is flat; sells when the last closed bar falls back below the SMA200 or price
 * drops 20% below the entry price.
 * When it does NOT work: long sideways chop where price keeps crossing the SMA200 —
 * each crossing costs a fee and a whipsaw; and a normal 15-20% pullback inside a
 * bull run that trips the stop and makes it re-enter higher.
 */
function onUpdate(ctx) {
  const trend = ctx.sma(200, 1);
  if (trend == null) return null;
  const prevClose = ctx.closes.at(-2); // last CLOSED bar, same bar the SMA200 uses
  if (prevClose == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  if (pos > 0) {
    // crash net: exit 20% below the fill price — wide enough to ignore normal
    // pullbacks, tight enough to get out before a crash runs to -50%
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) * 0.80;
    ctx.watch([
      { side: 'sell', price: trend, trigger: 'below', note: 'SMA200 breakdown' },
      { side: 'sell', price: st.stop, trigger: 'below', note: 'crash stop' }
    ]);
    if (prevClose < trend || price <= st.stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  st.stop = null;
  ctx.watch([
    { side: 'buy', price: trend, trigger: 'above', note: 'SMA200 reclaim' }
  ]);
  if (prevClose > trend) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
