/*
 * @coinsori-strategy v1
 * name: ETH Slow Trend Ride + Volume Filter 4H
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the plain 200-SMA trend ride proved robust on ETH (strong
 * downside protection, acceptable bull lag). Its only weakness is whipsaw in
 * sideways chop, where price pokes above the trend line on low volume then
 * falls back. Requiring above-average volume on the breakout entry is meant to
 * filter out those low-conviction pokes and keep only genuine trend starts.
 * When it buys and sells: long while price stays above the slow trend line,
 * sells when price closes below it, re-enters on a close back above that is
 * accompanied by above-average volume.
 * When it does NOT work: in a low-volume grind higher the volume filter may
 * keep us out of a real rally; and it still lags exact tops/bottoms.
 *
 * 2025-01-01: display-only ctx.watch added, trading logic unchanged.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const closePrev = ctx.closes[ctx.closes.length - 2];
  const closePrev2 = ctx.closes[ctx.closes.length - 3];
  if (sma == null || smaP == null || closePrev == null || closePrev2 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos <= 0) {
    // only enter a fresh long when the close crosses back above the trend line
    if (closePrev2 <= smaP && closePrev > sma) {
      // require the breakout bar to have traded above its 50-bar average volume
      const vols = ctx.volumes;
      if (vols == null || vols.length < 52) return null;
      const barVol = vols[vols.length - 2];       // previous (closed) bar volume
      let sum = 0;
      for (let k = 2; k <= 51; k++) sum += vols[vols.length - k]; // prior 50 bars
      const avg = sum / 50;
      if (avg <= 0) return null;
      if (barVol < avg) return null; // low-volume poke: skip, likely whipsaw
      ctx.watch([{ side:'buy', price: sma, trigger:'above', note:'SMA200 cross up + vol filter', conds:[
        { label:'Prev close > SMA200', now: closePrev, op:'>', ref: sma, closed:true },
        { label:'Bar volume > 50-bar avg', now: barVol, op:'>', ref: avg, closed:true }
      ]}]);
      return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
    }
    ctx.watch([{ side:'buy', price: sma, trigger:'above', note:'SMA200 cross up + vol filter', conds:[
      { label:'Prev close > SMA200', now: closePrev, op:'>', ref: sma, closed:true },
      { label:'Prev2 close <= SMA200', now: closePrev2, op:'<=', ref: smaP, closed:true }
    ]}]);
    return null;
  } else {
    if (closePrev < sma) {
      ctx.watch([{ side:'sell', price: sma, trigger:'below', note:'SMA200 cross down', conds:[
        { label:'Prev close < SMA200', now: closePrev, op:'<', ref: sma, closed:true }
      ]}]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side:'sell', price: sma, trigger:'below', note:'SMA200 cross down', conds:[
      { label:'Prev close < SMA200', now: closePrev, op:'<', ref: sma, closed:true }
    ]}]);
    return null;
  }
}
