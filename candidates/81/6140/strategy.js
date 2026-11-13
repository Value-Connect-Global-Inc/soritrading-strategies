/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian Squeeze 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On BTC perpetuals, negative funding means the crowd is short and paying longs to hold. When that happens while the 100-SMA trend is still up, it is a short-squeeze setup: crowded shorts + intact uptrend = fuel for a rebound. This is a contrarian positioning signal (funding), a different data family from the price-only trend rides already kept.
 * When it buys and sells: Long when funding is negative (crowd short) and price closes above the 100-SMA; sell when funding turns positive (crowd neutral) or a 2*ATR stop-loss is hit.
 * When it does NOT work: In a sustained bear, funding can stay negative for a long time and the 100-SMA filter is late, so it buys falling knives until the trend flips; in calm chop funding hovers near zero and the signal rarely fires, so it can sit flat through a slow grind higher.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const funding = ctx.funding; // per-8h funding rate (fraction)
  const smaLong = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  const closePrev = ctx.closes.at(-2);
  const price = ctx.price;

  if (funding == null || smaLong == null || atr == null || closePrev == null) {
    ctx.watch([]);
    return null;
  }

  // trend filter: only squeeze-long while price is above the 100-SMA (uptrend intact)
  const trendUp = closePrev > smaLong;
  // contrarian signal: crowd is short paying longs
  const crowdShort = funding < 0;
  // exit: crowd back to neutral (funding >= 0)
  const crowdNeutral = funding >= 0;

  const entryPx = ctx.entryPx;
  const stopPx = entryPx != null ? entryPx - 2 * atr : null;

  ctx.watch([
    { side:'buy', price: price, trigger:'below', note:'Long: funding negative + uptrend', conds:[ { label:'Funding(8h)', now:funding, op:'<', ref:0, closed:true }, { label:'Trend up (close>SMA100)', ok:trendUp } ] },
    { side:'sell', price: price, trigger:'above', note:'Exit: funding back >= 0', conds:[ { label:'Funding(8h)', now:funding, op:'>=', ref:0, closed:true } ] },
    { side:'sell', price: stopPx, trigger:'below', note:'2*ATR stop' }
  ]);

  if (pos <= 0) {
    if (trendUp && crowdShort) {
      if (atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
      // risk $500 per trade (5% of 10k), stop is 2*ATR away
      const riskQty = 500 / (2 * atr);
      const maxQty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty: Math.min(riskQty, maxQty) };
    }
    return null;
  }

  if (pos > 0) {
    if (crowdNeutral) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    if (stopPx != null && closePrev <= stopPx) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }
  return null;
}
