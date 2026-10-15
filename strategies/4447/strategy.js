/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd sentiment extremes in crypto tend to mark turning points — extreme fear usually comes near a local bottom. This strategy buys into panic only after the immediate selloff has stalled, then rides the recovery until greed returns.
 * When it buys and sells: Buys when the Fear & Greed index is at extreme fear (<=20) AND price has ticked back above its 10-day average (panic stalling); sells when the index reaches greed (>=60) or a 15% stop loss is hit.
 * When it does NOT work: In a persistent bear market (2018, 2022) extreme fear can last for months while price keeps sliding — the filter catches falling knives and the stop takes repeated small losses. Also index data only starts 2018, so no signal before then.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // no sentiment data yet (pre-2018)

  const px = ctx.price;
  const sma10 = ctx.sma(10, 1);
  if (sma10 == null) return null;

  const entryPx = ctx.entryPx;

  if (ctx.position <= 0) {
    // contrarian buy: extreme fear + the slide has stalled (price back above 10-day avg)
    if (fg <= 20 && px > sma10) {
      ctx.watch([{ side:'sell', price: px * 0.85, trigger:'below', note:'15% stop' },
                 { side:'sell', price: px, trigger:'above', note:'FG>=60 greed',
                   conds:[{ label:'FG index', now: fg, op:'>=', ref:60, closed:true }] }]);
      return { side:'buy', qty: ctx.cash / px * 0.99 };
    }
    ctx.watch([{ side:'buy', price: sma10, trigger:'above', note:'FG<=20 + bounce',
                 conds:[{ label:'FG index', now: fg, op:'<=', ref:20, closed:true }] }]);
    return null;
  }

  // holding: exit on greed (sentiment recovered) or the hard stop
  const stopPx = entryPx != null ? entryPx * 0.85 : null;
  const stopHit = stopPx != null && px <= stopPx;
  const exit = fg >= 60 || stopHit;

  const w = [{ side:'sell', price: stopPx != null ? stopPx : px * 0.85, trigger:'below', note:'15% stop' },
             { side:'sell', price: px, trigger:'above', note:'FG>=60 greed',
               conds:[{ label:'FG index', now: fg, op:'>=', ref:60, closed:true }] }];
  ctx.watch(w);

  if (exit) return { side:'sell', qty: ctx.position };
  return null;
}
