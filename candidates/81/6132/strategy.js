/*
 * @coinsori-strategy v1
 * name: BTC SMA100 Trend Ride 1D (diagnostic)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic: plain 100-day SMA trend ride with NO on-chain filter, to isolate whether the on-chain demand gate adds value. Long above the 100-day SMA, flat below.
 */

function onUpdate(ctx) {
  const sma = ctx.sma(100, 1);
  const smaP = ctx.sma(100, 2);
  const closePrev = ctx.closes.at(-2);
  const closePrev2 = ctx.closes.at(-3);
  const pos = ctx.position || 0;

  if (sma == null || smaP == null || closePrev == null || closePrev2 == null) {
    ctx.watch([]);
    return null;
  }

  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'close>100d SMA', conds:[
        { label:'Prev close > SMA', now:closePrev, op:'>', ref:sma, closed:true },
        { label:'Prev2 close <= SMA', now:closePrev2, op:'<=', ref:smaP, closed:true }
    ]},
    { side:'sell', price: sma, trigger:'below', note:'close < 100d SMA', conds:[
        { label:'Prev close < SMA', now:closePrev, op:'<', ref:sma, closed:true }
    ]}
  ]);

  if (pos <= 0) {
    if (closePrev2 <= smaP && closePrev > sma) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
    }
    return null;
  }
  if (pos > 0 && closePrev < sma) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
