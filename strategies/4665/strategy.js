/*
 * @coinsori-strategy v1
 * name: FearGreedContrarianBTC1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Extreme fear and extreme greed are sentiment extremes that historically mark
 * bottoms and tops for Bitcoin. We buy panic and sell euphoria.
 * When it buys and sells: Buy all-in when the Fear & Greed index falls below 15 (panic). Sell
 * everything when it rises above 80 (euphoria). Otherwise hold. A wide 3x ATR daily stop limits
 * damage if the panic keeps going.
 * When it does NOT work: In strong bull markets where greed stays above 80 for months it exits too
 * early and misses the rally. It also gives back gains in slow grind-downs where the index never
 * reaches extreme. Few trades per year by design.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // thresholds 15/80 = classic extreme zones from the index's own definition
  if (ctx.position > 0) {
    // exit on euphoria, or hard stop 3x ATR below entry (falling-knife protection)
    const stopPx = ctx.entryPx == null ? null : ctx.entryPx - atr * 3;
    if (fg > 80) {
      ctx.watch([{ side:'sell', note:'greed exit' }]);
      return { side: 'sell', qty: ctx.position };
    }
    if (stopPx != null && ctx.price < stopPx) {
      ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'ATR stop' }]);
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'ATR stop' },
               { side:'sell', note:'greed exit', conds:[{ label:'Fear&Greed', now: fg, op:'>', ref:80, closed:true }] }]);
    return null;
  }

  if (fg < 15) {
    ctx.watch([{ side:'buy', note:'panic buy', conds:[{ label:'Fear&Greed', now: fg, op:'<', ref:15, closed:true }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
