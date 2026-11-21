/*
 * @coinsori-strategy v1
 * name: BTC 4h VIX-Gated Mean Reversion v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin overreacts to short-term shocks and then mean-reverts, but only when the
 * macro environment is calm. This is a different family from the NDX trend champion: it buys oversold
 * dips (price 1.5 std-dev below its own 20-day mean) ONLY when the VIX is below its own 60-day mean
 * AND the 4h trend is already up (EMA50 above EMA200) — so it never catches a falling knife. It then
 * HOLDS until the trend breaks, so a dip bought in a bull market rides the whole trend instead of being
 * sold at the mean (v1/v2 lesson: selling at the mean or on a short rollover gives back the trend).
 * When it buys: BTC z-score below -1.5 (oversold) AND VIX below its own 60-day mean (calm) AND uptrend.
 * When it sells: EMA50 crosses below EMA200 (trend broke), or a -15% hard stop.
 * When it does NOT work: in a bull with no deep dips it sits in cash and misses the rally; in a slow
 * grind lower with low VIX, oversold can stay oversold and it keeps buying dips until the trend break
 * or the stop.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  const z = ctx.zscore(120, 1); // 20-day z-score of close (4h), closed bar
  const s120 = ctx.sma(120, 1);
  const sd120 = ctx.stdev(120, 1);
  if (e50 == null || e200 == null || z == null || s120 == null || sd120 == null) return null;
  const vix = ctx.data('base_vix');
  if (vix == null) return null;

  // rolling ~60-day VIX mean (daily series, repeats for 6 bars on 4h)
  let vHist = ctx.state.vHist || [];
  const vLast = vHist.length ? vHist[vHist.length - 1] : null;
  if (vLast === null || Math.abs(vLast - vix) > 1e-9) {
    vHist = vHist.concat([vix]);
    if (vHist.length > 60) vHist = vHist.slice(-60);
    ctx.state.vHist = vHist;
  }
  if (vHist.length < 40) return null;
  const vMean = vHist.reduce((a, b) => a + b, 0) / vHist.length;
  const calm = vix < vMean;

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const dipLevel = s120 - 1.5 * sd120; // the price level that makes z = -1.5
  const stop = entry != null ? entry * 0.85 : 0;
  const up = e50 > e200;

  const watchList = [];
  if (pos === 0) {
    watchList.push({ side:'buy', price: dipLevel, trigger:'below', note:'dip in uptrend', conds:[{label:'VIX calm', ok: calm},{label:'uptrend', ok: up}] });
  } else {
    watchList.push({ side:'sell', price: e200, trigger:'below', note:'trend broke' });
    watchList.push({ side:'sell', price: stop, trigger:'below', note:'hard stop' });
  }
  ctx.watch(watchList);

  if (pos > 0 && entry != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  // buy the dip only in an uptrend with calm volatility — never catch a falling knife
  if (pos === 0 && calm && up && price <= dipLevel) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
