/*
 * @coinsori-strategy v1
 * name: Uptrend Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — buys once when close > ema200 (uptrend), to see
 * whether the uptrend condition alone fires in the recent window.
 * When it buys and sells: buys once on first uptrend bar, never sells.
 * When it does NOT work: every time — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  const e = ctx.ema(200, 1);
  if (e == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  if (prevClose <= e) return null;
  if (ctx.position > 0) return null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
}
