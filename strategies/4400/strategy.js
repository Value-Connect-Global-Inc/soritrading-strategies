/*
 * @coinsori-strategy v1
 * name: DXY Data Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — trades on the very first bar where ctx.data('dxy')
 * is non-null, to confirm whether the dxy dataset resolves in backtest.
 * When it buys and sells: buys once when dxy is first available, sells never.
 * When it does NOT work: every time — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  const d = ctx.data('dxy');
  if (d == null) return null;
  if (ctx.position > 0) return null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
}
