/*
 * @coinsori-strategy v1
 * name: BTC 4h On-Chain Demand Trend Ride
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Price trends are only real when backed by network usage. Bitcoin's
 * daily active addresses are an on-chain demand signal that often rolls over before price
 * does, so exiting a trend when usage contracts should cut the deep crash drawdowns that
 * pure moving averages lag.
 * When it buys: EMA50 above EMA200 (uptrend) and on-chain demand expanding (active
 * addresses above their 30-day average).
 * When it sells: price falls below EMA50 while on-chain demand is contracting (addresses
 * below 97% of their 30-day average), the trend flips down, or a -20% hard stop.
 * When it does NOT work: in a rally not backed by new users (addresses flat while price
 * rises) it stays out and misses gains; the on-chain signal is daily and slow, so a sudden
 * flash crash can still hit the hard stop before the gate reacts.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // on-chain demand: current daily active addresses vs their 30-day average
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (addr == null || addrSma == null) return null;
  const demand = addr / addrSma; // >1 = usage above its 30d average

  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const price = ctx.price;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'EMA50 over EMA200', conds:[{label:'demand ratio', now: demand, op:'>=', ref: 1.0, closed:true}] },
    { side:'sell', price: e50, trigger:'below', note:'weak trend + demand off', conds:[{label:'demand ratio', now: demand, op:'<=', ref: 0.97, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke' },
    { side:'sell', price: stop, trigger:'below', note:'hard stop' }
  ]);

  // exits
  if (inPos) {
    if (ctx.entryPx != null && price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    // demand contraction confirmed by price weakness: exit while the trend is still up
    if (price <= e50 && demand <= 0.97) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // entry: uptrend AND on-chain demand expanding
  if (up && demand >= 1.0) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
