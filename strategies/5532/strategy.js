/*
 * @coinsori-strategy v1
 * name: PROBE addr value change 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: trades only when the addr value CHANGES between bars.
 * If the dataset returns a constant value, this never trades -> proves
 * the data is static/placeholder. If it trades often, the data varies.
 */
function onUpdate(ctx) {
  const a = ctx.data('addr');
  if (a == null) return null;
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.prevVal = s.curVal;
    s.lastBarI = ctx.i;
  }
  s.curVal = a;
  if (s.prevVal == null || s.prevVal === a) return null; // no change -> no trade
  const pos = ctx.position || 0;
  if (a > s.prevVal) {
    if (pos > 0) return null;
    return { side: 'buy', qty: 0.0001 };
  } else {
    if (pos <= 0) return null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
}
