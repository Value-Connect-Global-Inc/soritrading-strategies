/*
 * @coinsori-strategy v1
 * name: BTC Trend Ride 4H (diag)
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: diagnostic build to find why a slow trend strategy churns ~800 round trips.
 * When it buys and sells: long when price > EMA100; exits on price < EMA200 or 20% trailing stop.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  const TRAIL = 0.20;
  const emaIn = ctx.ema(100, 1);
  const emaOut = ctx.ema(200, 1);
  if (emaIn == null || emaOut == null) { ctx.watch([]); return null; }
  const price = ctx.price;
  const st = ctx.state;
  if (!st.logged) st.logged = 0;
  if (!st.entryBar) st.entryBar = null;

  if (ctx.position > 0) {
    if (st.hi == null || price > st.hi) st.hi = price;
  } else {
    st.hi = null;
  }

  const trendUp = price > emaIn;
  const trendBroken = price < emaOut;

  if (ctx.position > 0) {
    const stopPx = st.hi != null ? st.hi * (1 - TRAIL) : null;
    if (trendBroken) {
      if (st.logged < 60) { ctx.log("SELL-TREND bar=" + ctx.i + " px=" + price.toFixed(0) + " e200=" + emaOut.toFixed(0) + " held=" + (st.entryBar != null ? (ctx.i - st.entryBar) : -1)); st.logged++; }
      ctx.watch([{ side:'sell', price: ctx.price, trigger:'below', note:'trend broken' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    if (stopPx != null && price < stopPx) {
      if (st.logged < 60) { ctx.log("SELL-STOP bar=" + ctx.i + " px=" + price.toFixed(0) + " hi=" + st.hi.toFixed(0) + " stop=" + stopPx.toFixed(0) + " held=" + (st.entryBar != null ? (ctx.i - st.entryBar) : -1)); st.logged++; }
      ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'20% trailing stop' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side:'sell', price: stopPx != null ? stopPx : price * (1 - TRAIL), trigger:'below', note:'20% trailing stop' }]);
    return null;
  }

  if (trendUp) {
    if (st.logged < 60) { ctx.log("BUY bar=" + ctx.i + " px=" + price.toFixed(0) + " e100=" + emaIn.toFixed(0) + " e200=" + emaOut.toFixed(0)); st.logged++; }
    st.entryBar = ctx.i;
    ctx.watch([{ side:'buy', price: ctx.price, trigger:'below', note:'trend up' }]);
    return { side:'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([]);
  return null;
}
