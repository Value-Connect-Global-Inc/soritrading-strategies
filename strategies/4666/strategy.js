/*
 * @coinsori-strategy v1
 * name: FearGreedDipInUptrendBTC1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Extreme fear is a good signal only when the longer trend is still up —
 * panic in an uptrend is a dip, panic in a downtrend is a falling knife.
 * When it buys and sells: Buy all-in when Fear & Greed < 15 AND price is above the 200-day
 * average (uptrend context). Sell on greed > 80 or a 3x ATR stop. Otherwise hold.
 * When it does NOT work: In a bear market the buy never triggers (stays flat — good). In a
 * choppy sideways market it whipsaws. It misses the start of a new bull if the first fear
 * spike happens below the 200-day average.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || sma200 == null) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
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

  // uptrend filter: price above 200-day average — buy dips only in bull context
  if (fg < 15 && prevClose > sma200) {
    ctx.watch([{ side:'buy', note:'panic dip in uptrend', conds:[{ label:'Fear&Greed', now: fg, op:'<', ref:15, closed:true },
                                                               { label:'Close>SMA200', ok: prevClose > sma200, closed:true }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
