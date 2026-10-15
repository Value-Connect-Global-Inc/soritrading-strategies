/*
 * @coinsori-strategy v1
 * name: Always-Trade Probe
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys a tiny amount every bar regardless of
 * anything, so the trade count tells us whether multi-symbol backtests run
 * onUpdate at all.
 * When it buys and sells: buys 0.001 then sells next bar, forever.
 * When it does NOT work: probes are throwaway diagnostics.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const pos = ctx.position;
  if (pos > 0) return { side: 'sell', qty: pos };
  return { side: 'buy', qty: 0.001 };
}
