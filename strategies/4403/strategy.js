/*
 * @coinsori-strategy v1
 * name: EMA200 DXY Co-Resolve Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — buys when both ema200 and dxy are non-null,
 * to confirm the gate strategy's guards aren't silently blocking.
 * When it buys and sells: buys once when both resolve, never sells.
 * When it does NOT work: every time — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  const e = ctx.ema(200, 1);
  const d = ctx.data('dxy');
  if (e == null || d == null) return null;
  if (ctx.position > 0) return null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
}
