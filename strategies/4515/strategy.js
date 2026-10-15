/*
 * @coinsori-strategy v1
 * name: Probe B fear_greed data
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic probe: buys unconditionally at bar 120 IF ctx.data('fear_greed')
 * is non-null, proving whether the fear_greed dataset is available in backtest.
 */
function onUpdate(ctx) {
  const c = ctx.closes;
  if (c.length < 150) return null;
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
}
