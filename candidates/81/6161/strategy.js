/*
 * @coinsori-strategy v1
 * name: ETH Donchian 55 + SMA200 Regime Exit 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A daily close breaking above the 55-day high usually starts a sustained trend.
 * Instead of a tight stop that gets whipsawed by crypto's violent pullbacks, we hold the whole
 * uptrend and only sell when the close falls back below the 200-day average (a real regime flip).
 * Requiring price above the 200-day average on entry keeps us out of bear-market false breakouts.
 * When it buys and sells: Buy when the daily close closes above the highest high of the last 55 days
 * while price is above the 200-day average. Sell when the close drops below the 200-day average.
 * When it does NOT work: In a long sideways range with no real breakouts, and in slow grinding bear
 * markets where every recovery attempt makes a small new high and then fails.
 */
function onUpdate(ctx) {
  // Closed-bar values only. The signal bar is ago=1 (last closed bar); the breakout reference
  // window is the 55 bars BEFORE it (ago=2..), so a close can actually exceed the reference.
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const donHigh = ctx.high(55, 2); // highest high of the 55 bars before the last closed bar
  const sma200  = ctx.sma(200, 1);
  if (donHigh == null || sma200 == null) return null;

  const inPos = ctx.position > 0;

  if (inPos) {
    // Regime exit: close back below the 200-day average = trend flip.
    ctx.watch([{ side:'sell', price: sma200, trigger:'below', note:'SMA200 regime exit' }]);
    if (prevClose < sma200) {
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // Entry: 55-day high breakout, only in an uptrend regime (price above the 200-day average).
  ctx.watch([{ side:'buy', price: donHigh, trigger:'above', note:'Donchian 55d high breakout',
               conds:[{ label:'Close > SMA200', ok: prevClose > sma200, closed:true }] }]);
  if (prevClose > donHigh && prevClose > sma200) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    return { side:'buy', qty };
  }
  return null;
}
