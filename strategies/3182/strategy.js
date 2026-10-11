/*
 * @coinsori-strategy v1
 * name: ETH 4H Donchian Breakout Trend
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH's multi-day trends on the 4h chart often start when
 * price clears a ~9-day range. A Donchian breakout catches those trend starts;
 * a shorter Donchian exit cuts losers fast.
 * When it buys and sells: Buys when a CLOSED bar closes above the highest high
 * of the previous 55 bars (about 9 days). Sells when a closed bar closes below
 * the lowest low of the previous 20 bars (tight trailing exit).
 * When it does NOT work: Choppy sideways markets produce false breakouts and
 * repeated whipsaw losses; it also sits out of bear-market rallies.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const prevClose = ctx.closes[1];
  if (prevClose == null) {
    ctx.watch([]);
    return null;
  }

  // breakout level: highest high of the 55 bars BEFORE the last closed bar
  const hh = ctx.high(55, 2);
  // exit level: lowest low of the 20 bars before the last closed bar
  const ll = ctx.low(20, 2);
  if (hh == null || ll == null) {
    ctx.watch([]);
    return null;
  }

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ll, trigger: 'below', note: 'Donchian exit', conds: [{ label: 'prevClose < LL', now: prevClose, op: '<', ref: ll, closed: true }] }]);
    if (prevClose < ll) return { side: 'sell', qty: pos };
    return null;
  }

  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'Donchian breakout', conds: [{ label: 'prevClose > HH', now: prevClose, op: '>', ref: hh, closed: true }] }]);
  if (prevClose > hh) {
    return { side: 'buy', qty: ctx.cash / px * 0.99 };
  }
  return null;
}
