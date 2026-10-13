/*
 * @coinsori-strategy v1
 * name: ArrayStateProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic only — tests whether an ARRAY stored in ctx.state
 * persists across bars (the counter probe worked, but the real strategy stores an array).
 * Buys once the stored array reaches length 10.
 * When it buys and sells: Buys when array length hits 10, sells at length 15.
 * When it does NOT work: Not a real strategy. Throwaway probe.
 */

function onUpdate(ctx) {
  let arr = ctx.state.arr;
  if (!Array.isArray(arr)) arr = [];
  arr.push(ctx.price);
  if (arr.length > 15) arr = arr.slice(-15);
  ctx.state.arr = arr;

  const c = (ctx.state.c || 0) + 1;
  ctx.state.c = c;
  if (c === 10) return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  if (c === 15) return { side:'sell', qty: ctx.position };
  return null;
}
