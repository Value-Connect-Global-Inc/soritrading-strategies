/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Demand Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily unique active addresses measure real network usage. When usage is clearly contracting (well below its 30-day average), rallies are not backed by real demand and tend to fail. A slow price trend ride is kept, but entries are blocked while on-chain usage is collapsing — a defensive filter rather than a strict gate.
 * When it buys and sells: Buys when a closed daily bar closes above the 100-day SMA, unless daily active addresses are clearly contracting (below 95% of their 30-day average). Sells when a closed bar closes back below the 100-day SMA.
 * When it does NOT work: In a late-stage mania on-chain usage can stay elevated while price already rolls over, so the exit lags the top. In a price melt-up with flat on-chain usage it stays out and misses the gains.
 */

function onUpdate(ctx) {
  const sma = ctx.sma(100, 1);
  const smaP = ctx.sma(100, 2);
  const closePrev = ctx.closes.at(-2);
  const closePrev2 = ctx.closes.at(-3);
  const addr = ctx.data("addr");
  const addrSma = ctx.data("addr_sma30");
  const pos = ctx.position || 0;

  if (sma == null || smaP == null || closePrev == null || closePrev2 == null || addr == null || addrSma == null || addrSma <= 0) {
    ctx.watch([]);
    return null;
  }

  // demand ratio >1 = usage above its 30-day norm. We only block entries when it is clearly contracting (<0.95).
  const demand = addr / addrSma;

  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'close>100d SMA, usage not collapsing', conds:[
        { label:'Prev close > SMA', now:closePrev, op:'>', ref:sma, closed:true },
        { label:'Prev2 close <= SMA', now:closePrev2, op:'<=', ref:smaP, closed:true },
        { label:'On-chain usage >= 0.95', now:demand, op:'>=', ref:0.95, closed:true }
    ]},
    { side:'sell', price: sma, trigger:'below', note:'close < 100d SMA', conds:[
        { label:'Prev close < SMA', now:closePrev, op:'<', ref:sma, closed:true }
    ]}
  ]);

  if (pos <= 0) {
    if (closePrev2 <= smaP && closePrev > sma && demand >= 0.95) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
    }
    return null;
  }
  if (pos > 0 && closePrev < sma) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
