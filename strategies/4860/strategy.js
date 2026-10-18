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

  // rebalance once a week on 1d bars to keep turnover low
  if (ctx.i % 7 !== 0) return null;

  const lookback = 30;
  const topN = 2;

  const moms = [];
  for (const s of syms) {
    const m = ctx.market(s);
    const closes = m ? m.closes : null;
    if (!closes || closes.length < lookback + 1) {
      moms.push({ s: s, mom: -Infinity });
      continue;
    }
    const cur = closes[closes.length - 1];
    const prev = closes[closes.length - 1 - lookback];
    moms.push({ s: s, mom: prev > 0 ? cur / prev - 1 : 0 });
  }

  moms.sort((a, b) => b.mom - a.mom);
  const top = new Set(moms.slice(0, topN).map(x => x.s));

  const mySym = ctx.sym;
  const pos = ctx.position;

  if (top.has(mySym)) {
    if (pos <= 0) {
      // equal-weight share of cash for each of the top-N slots
      return { side: 'buy', qty: (ctx.cash / topN) / ctx.price * 0.98 };
    }
    return null;
  }
  if (pos > 0) {
    return { side: 'sell', qty: pos };
  }
  return null;
}
