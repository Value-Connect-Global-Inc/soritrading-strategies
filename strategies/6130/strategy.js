/*
 * @coinsori-strategy v1
 * name: ETH SMA200 Trend Ride 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Ethereum's 4h price tends to trend for extended periods once it is clearly above or below its slow 200-bar average. Riding the trend while it holds and stepping out when it breaks is a simple, robust way to capture most of the upside while avoiding the deep drawdowns of holding through bear phases.
 * When it buys and sells: Buys when the previous closed bar crosses back above the 200-bar SMA. Sells when a closed bar falls back below the 200-bar SMA.
 * When it does NOT work: In long sideways chop it whipsaws on the trend line (buy/sell repeatedly at small losses), and in a parabolic mania it re-enters late and cannot keep up with buy-and-hold.
 */

function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const closePrev = ctx.closes.at(-2);
  const closePrev2 = ctx.closes.at(-3);
  const pos = ctx.position || 0;

  if (sma == null || smaP == null || closePrev == null || closePrev2 == null) {
    ctx.watch([]);
    return null;
  }

  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'SMA200 cross up', conds:[ { label:'Prev close > SMA', now:closePrev, op:'>', ref:sma, closed:true }, { label:'Prev2 close <= SMA', now:closePrev2, op:'<=', ref:smaP, closed:true } ] },
    { side:'sell', price: sma, trigger:'below', note:'SMA200 cross down', conds:[ { label:'Prev close < SMA', now:closePrev, op:'<', ref:sma, closed:true } ] }
  ]);

  if (pos <= 0) {
    if (closePrev2 <= smaP && closePrev > sma) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
    }
    return null;
  }

  if (pos > 0) {
    if (closePrev < sma) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }
  return null;
}
