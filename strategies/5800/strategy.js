/*
 * @coinsori-strategy v1
 * name: DIAG ch60 units probe 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT
 * interval: 1d
 * cash: 10000
 *
 * Throwaway diagnostic: print ch1/ch5/ch60 values for every symbol at bar 100.
 */
function onUpdate(ctx) {
  if (ctx.i < 100 || ctx.i > 100) return null;
  const out = {};
  for (const s of ctx.syms) {
    const m = ctx.market(s);
    out[s] = m == null ? 'null' : { price: m.price, ch1: m.ch1, ch5: m.ch5, ch60: m.ch60 };
  }
  throw new Error('DIAG ' + JSON.stringify(out));
}
