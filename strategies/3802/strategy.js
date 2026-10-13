/*
 * @coinsori-strategy v1
 * name: FundingProbe4
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Diagnostic only: buys 1 coin whenever ctx.funding is non-null, sells next bar.
 * Purpose: does ctx.funding ever return data on 4h futures bars at all?
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  if (pos > 0) return { side:'sell', qty: pos };
  if (ctx.funding != null) return { side:'buy', qty: 0.01 };
  return null;
}
