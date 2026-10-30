/*
 * @coinsori-strategy v1
 * name: DIAG market shape probe 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT
 * interval: 1d
 * cash: 10000
 *
 * Throwaway diagnostic: dump the shape of ctx.market(sym) and ctx.markets() at bar 60.
 */
function onUpdate(ctx) {
  if (ctx.i < 60 || ctx.i > 60) return null;
  const info = {};
  try {
    const m = ctx.market(ctx.sym);
    info.market = m == null ? 'null' : Object.keys(m).join(',');
  } catch (e) { info.marketErr = String(e); }
  try {
    const ms = ctx.markets();
    info.markets = ms == null ? 'null' : (Array.isArray(ms) ? 'array:' + ms.length : typeof ms);
    if (Array.isArray(ms) && ms.length) {
      info.m0 = Object.keys(ms[0]).join(',');
      const c = ms[0].closes;
      info.m0closes = c == null ? 'null' : (Array.isArray(c) ? 'arr:' + c.length : typeof c);
    }
  } catch (e) { info.marketsErr = String(e); }
  throw new Error('DIAG ' + JSON.stringify(info));
}
