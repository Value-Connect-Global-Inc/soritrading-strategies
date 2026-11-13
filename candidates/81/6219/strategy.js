/*
 * @coinsori-strategy v1
 * name: BTC Macro-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a surging US dollar is a drag on Bitcoin; when the dollar is calm or falling, BTC trends can be ridden. This layers a slow macro filter on top of a 4h trend.
 * When it buys and sells: it is long BTC when price is above its 100-bar EMA and the dollar is not rising fast; it exits only on a real trend break (price below the 200-bar EMA), a dollar surge (up >1.5% in 10 days), or price falling 20% from its best level since entry. The wide exits are deliberate so normal pullbacks are not sold.
 * When it does NOT work: in long sideways markets the trend flips slowly and it pays fees, and a dollar filter cannot protect against crypto-specific crashes (hacks, regulation) that happen while the dollar is calm.
 */
function onUpdate(ctx) {
  const TRAIL = 0.20;  // 20% trailing stop: BTC 4h pullbacks of 10-15% are normal, this survives them
  const emaIn = ctx.ema(100, 1);
  const emaOut = ctx.ema(200, 1);
  const usd = ctx.data("base_usd_broad");
  if (emaIn == null || emaOut == null || usd == null) { ctx.watch([]); return null; }

  const st = ctx.state;
  if (!st.usdHist) st.usdHist = [];
  st.usdHist.push(usd);
  if (st.usdHist.length > 61) st.usdHist.shift();
  if (st.usdHist.length < 61) { ctx.watch([]); return null; }  // need ~10 days of dollar history

  const usdChg = usd / st.usdHist[0] - 1;   // 10-day change of the broad dollar index
  const price = ctx.price;

  // trailing best level since entry (reset when flat)
  if (ctx.position > 0) {
    if (st.hi == null || price > st.hi) st.hi = price;
  } else {
    st.hi = null;
  }

  const trendUp = price > emaIn;
  const trendBroken = price < emaOut;
  const dollarOk = usdChg < 0.010;          // entry: dollar not up more than 1% in 10 days
  const dollarBad = usdChg > 0.015;         // exit: dollar up more than 1.5% in 10 days (band = hysteresis)

  if (ctx.position > 0) {
    const stopPx = st.hi != null ? st.hi * (1 - TRAIL) : null;
    if (trendBroken || dollarBad) {
      ctx.watch([{ side:'sell', price: ctx.price, trigger:'below', note:'trend/macro exit' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    if (stopPx != null && price < stopPx) {
      ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'20% trailing stop' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side:'sell', price: stopPx != null ? stopPx : price * (1 - TRAIL), trigger:'below', note:'20% trailing stop' }]);
    return null;
  }

  if (trendUp && dollarOk) {
    ctx.watch([{ side:'buy', price: ctx.price, trigger:'below', note:'trend up + dollar calm', conds:[{ label:'dollar 10d chg %', now: usdChg * 100, op:'<', ref: 1.0, closed:true }] }]);
    return { side:'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([]);
  return null;
}
