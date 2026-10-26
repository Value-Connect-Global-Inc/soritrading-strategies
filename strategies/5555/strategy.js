/*
 * @coinsori-strategy v1
 * name: PROBE ctx.market fields 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: temporary probe. Tries several candidate fields on ctx.market(sym)
 * and ctx.markets(); buys a tiny amount if any plausible price/history field is found.
 * When it buys and sells: probe only.
 * When it does NOT work: not a real strategy.
 */
function onUpdate(ctx) {
  try {
    const m = ctx.market(ctx.sym);
    if (m != null) {
      const cand = ['price', 'last', 'close', 'closes', 'c', 'history', 'bars', 'candle', 'ohlc'];
      for (const k of cand) {
        if (m[k] != null) {
          const v = m[k];
          const isArr = Array.isArray(v);
          const len = isArr ? v.length : (typeof v === 'object' ? 'obj' : 'scalar');
          if (isArr && v.length > 30) return { side: 'buy', qty: 0.0001 };
          if (typeof v === 'number' && v > 0) return { side: 'buy', qty: 0.0001 };
        }
      }
    }
  } catch (e) { /* fall through */ }
  try {
    const all = ctx.markets();
    if (all != null && Array.isArray(all) && all.length > 0) {
      const first = all[0];
      if (first != null && first.price != null && first.price > 0) return { side: 'buy', qty: 0.0001 };
    }
  } catch (e) { /* fall through */ }
  return null;
}
