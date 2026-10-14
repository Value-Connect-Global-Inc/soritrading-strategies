/*
 * @coinsori-strategy v1
 * name: DXY Frequency Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — buys when dxy is non-null, sells when it goes null,
 * to count how often the dataset actually resolves in a backtest.
 * When it buys and sells: toggles position on dxy availability.
 * When it does NOT work: every time — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  const d = ctx.data('dxy');
  if (ctx.position > 0) {
    if (d == null) return { side: 'sell', qty: ctx.position };
    return null;
  }
  if (d == null) return null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
}
