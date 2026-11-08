/*
 * @coinsori-strategy v1
 * name: SOL Donchian Breakout Trend 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: SOL trends hard in both directions on 4h. A Donchian breakout enters when price closes above the highest high of the last 50 bars and exits when it closes below the lowest low of the last 20 bars — a classic turtle-style trend follower that rides strong moves and steps aside in crashes.
 * When it buys and sells: Buys on a close above the 50-bar high; sells on a close below the 20-bar low. Position sized by ATR so bigger moves risk the same dollars.
 * When it does NOT work: In long sideways chop it whipsaws and pays fees on false breakouts; in a mild uptrend that never makes new highs it never enters and misses the move.
 */

function onUpdate(ctx) {
  const closePrev = ctx.closes.at(-2);
  const pos = ctx.position || 0;

  // need enough closed bars: 50 for entry high, 20 for exit low
  if (ctx.closes.length < 60 || closePrev == null) {
    ctx.watch([]);
    return null;
  }

  // Donchian over CLOSED bars only (ago>=1 semantics): N bars ending at the previous closed bar
  const ENTRY_N = 50, EXIT_N = 20;
  const hh = Math.max(...ctx.highs.slice(-ENTRY_N - 1, -1));
  const ll = Math.min(...ctx.lows.slice(-EXIT_N - 1, -1));
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  ctx.watch([
    { side:'buy', price: hh, trigger:'above', note:'Donchian 50 breakout', conds:[ { label:'Prev close > 50-bar high', now:closePrev, op:'>', ref:hh, closed:true } ] },
    { side:'sell', price: ll, trigger:'below', note:'Donchian 20 exit', conds:[ { label:'Prev close < 20-bar low', now:closePrev, op:'<', ref:ll, closed:true } ] }
  ]);

  if (pos <= 0) {
    if (closePrev > hh) {
      // risk $500 per trade: qty = risk / ATR, capped at ~full cash so extreme vol de-risks but normal vol is fully invested
      const risk = 500;
      const qty = risk / atr;
      const maxQty = (ctx.cash / ctx.price) * 0.98;
      return { side:'buy', qty: Math.min(qty, maxQty) };
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
