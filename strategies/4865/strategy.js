/*
 * @coinsori-strategy v1
 * name: XSecMom5_v2_slow60
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto coins show persistent relative strength — the strongest coins keep outperforming for weeks, so holding only the top performers captures more of the trend than a fixed basket. Slower 60-day momentum filters out short-term noise.
 * When it buys and sells: once a week it ranks the 5 coins by 60-day return and holds the top 2 equally; coins that drop out of the top 2 are sold.
 * When it does NOT work: in a broad crash all coins fall together; in a flat market ranks flip weekly and it churns.
 */
function onUpdate(ctx) {
  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;

  const lookback = 60;
  const topN = 2;

  const closes = ctx.closes;
  if (!ctx.state.mom) ctx.state.mom = {};
  if (closes.length >= lookback + 2) {
    const cur = closes[closes.length - 2];
    const prev = closes[closes.length - 2 - lookback];
    ctx.state.mom[ctx.sym] = prev > 0 ? cur / prev - 1 : 0;
  } else {
    ctx.state.mom[ctx.sym] = -Infinity;
  }

  if (ctx.i % 7 !== 0) return null;

  const moms = [];
  for (const s of syms) {
    const v = ctx.state.mom[s];
    moms.push({ s: s, mom: v == null ? -Infinity : v });
  }
  moms.sort((a, b) => b.mom - a.mom);
  const top = new Set(moms.slice(0, topN).map(x => x.s));

  const pos = ctx.position;
  if (top.has(ctx.sym)) {
    if (pos <= 0) {
      return { side: 'buy', qty: (ctx.cash / topN) / ctx.price * 0.98 };
    }
    return null;
  }
  if (pos > 0) {
    return { side: 'sell', qty: pos };
  }
  return null;
}
