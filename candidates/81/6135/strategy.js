/*
 * @coinsori-strategy v1
 * name: Donchian Breakout Trend 4H
 * ex: binance
 * syms: BNB/USDT, ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Strong-trending assets on 4h reward breakout following. A Donchian breakout enters when price closes above the highest high of the last 50 bars and exits when it closes below the lowest low of the last 20 bars — a classic turtle-style trend follower that rides strong moves and steps aside in crashes.
 * When it buys and sells: Buys on a close above the 50-bar high, fully invested; sells on a close below the 20-bar low.
 * When it does NOT work: In long sideways chop it whipsaws and pays fees on false breakouts; in a mild uptrend that never makes new highs it never enters and misses the move; in an extreme mania it cannot match a full buy-and-hold.
 */

function onUpdate(ctx) {
  const closePrev = ctx.closes.at(-2);
  const pos = ctx.position || 0;

  if (ctx.closes.length < 60 || closePrev == null) {
    ctx.watch([]);
    return null;
  }

  // Donchian over CLOSED bars only. The window must end at the bar BEFORE the
  // signal bar (exclude current bar AND signal bar) or close could never exceed it.
  const ENTRY_N = 50, EXIT_N = 20;
  const hh = Math.max(...ctx.highs.slice(-ENTRY_N - 2, -2));
  const ll = Math.min(...ctx.lows.slice(-EXIT_N - 2, -2));

  ctx.watch([
    { side:'buy', price: hh, trigger:'above', note:'Donchian 50 breakout', conds:[ { label:'Prev close > 50-bar high', now:closePrev, op:'>', ref:hh, closed:true } ] },
    { side:'sell', price: ll, trigger:'below', note:'Donchian 20 exit', conds:[ { label:'Prev close < 20-bar low', now:closePrev, op:'<', ref:ll, closed:true } ] }
  ]);

  if (pos <= 0) {
    if (closePrev > hh) {
      return { side:'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    }
    return null;
  }

  if (pos > 0) {
    if (closePrev < ll) {
      return { side:'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }
  return null;
}
