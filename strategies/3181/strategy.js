/*
 * @coinsori-strategy v1
 * name: BTC 1D Donchian Breakout Trend
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: BTC's biggest daily moves start when price clears a
 * multi-week range on the daily chart. A Donchian breakout catches the start
 * of those trends, and a shorter Donchian exit cuts losers fast.
 * When it buys and sells: Buys when a CLOSED bar closes above the highest high
 * of the previous 55 days. Sells when a closed bar closes below the lowest low
 * of the previous 20 days (tight trailing exit).
 * When it does NOT work: Choppy sideways markets produce false breakouts and
 * repeated whipsaw losses; it also sits out of bear-market rallies.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) { ctx.watch([]); return null; }

  const pos = ctx.position;
  const prevClose = ctx.closes[1];
  if (prevClose == null) { ctx.watch([]); return null; }

  // breakout level: highest high of the 55 days BEFORE the last closed day
  const hh = ctx.high(55, 2);
  // exit level: lowest low of the 20 days before the last closed day
  const ll = ctx.low(20, 2);
  if (hh == null || ll == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      price: ll,
      trigger: 'below',
      note: 'Donchian exit',
      conds: [{ label: 'prevClose < ll', now: prevClose, op: '<', ref: ll, closed: true }]
    }]);
    if (prevClose < ll) return { side: 'sell', qty: pos };
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: hh,
    trigger: 'above',
    note: 'Donchian breakout entry',
    conds: [{ label: 'prevClose > hh', now: prevClose, op: '>', ref: hh, closed: true }]
  }]);
  if (prevClose > hh) {
    return { side: 'buy', qty: ctx.cash / px * 0.99 };
  }
  return null;
}
