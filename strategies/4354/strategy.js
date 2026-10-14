/*
 * @coinsori-strategy v1
 * name: Liq-Fade OI Probe BTC Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: PROBE — confirm the binanceusdm backtest actually
 *   executes onUpdate and fills orders. Not a real strategy.
 * When it buys and sells: buys a tiny 10% position every tick once ATR is
 *   available, to verify fills happen on this exchange.
 * When it does NOT work: PROBE ONLY — do not judge performance.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  return { side: 'buy', qty: (ctx.cash / price) * 0.1 };
}
