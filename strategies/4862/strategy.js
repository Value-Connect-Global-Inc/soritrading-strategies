/*
 * @coinsori-strategy v1
 * name: CrossSectionalMomentum5
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto coins show persistent relative strength — the strongest coins keep outperforming for weeks, so holding only the top performers (and rotating out of laggards) captures more of the trend than a fixed basket.
 * When it buys and sells: once a week it ranks the 5 coins by 30-day return and holds the top 2 equally; coins that drop out of the top 2 are sold, new ones are bought.
 * When it does NOT work: when all coins move together in a broad crash, the "best" coin still falls; in a flat market where ranks flip every week it churns and pays fees for nothing.
 */
function onUpdate(ctx) {
  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;

  const lookback = 30;
  const topN = 2;

  // my own momentum from my own closes (last CLOSED bar, same for all symbols at this bar)
  const closes = ctx.closes;
  if (!ctx.state.mom) ctx.state.mom = {};
  if (closes.length >= lookback + 2) {
    const cur = closes[closes.length - 2];
    const prev = closes[closes.length - 2 - lookback];
    ctx.state.mom[ctx.sym] = prev > 0 ? cur / prev - 1 : 0;
  } else {
    ctx.state.mom[ctx.sym] = -Infinity;
  }

  // only rebalance weekly to keep turnover low
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
      // each of the top-N slots invests an equal share of cash
      return { side: 'buy', qty: (ctx.cash / topN) / ctx.price * 0.98 };
    }
    return null;
  }
  if (pos > 0) {
    return { side: 'sell', qty: pos };
  }
  return null;
}
