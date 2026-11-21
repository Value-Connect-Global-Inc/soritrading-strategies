/*
 * @coinsori-strategy v1
 * name: BTC 4h VIX Falling Regime Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset — when stock-market fear (the CBOE VIX index) is
 * FALLING, fear is receding and BTC uptrends are more likely to extend. This uses the CHANGE in
 * VIX (today lower than a few days ago) rather than a level, so the gate re-opens as soon as
 * volatility contracts after a spike — a level gate stays closed for months after a crash.
 * When it buys: EMA50 above EMA200 (uptrend) and VIX falling (today's daily VIX below the value
 * from ~3 days ago).
 * When it sells: uptrend breaks, VIX rises back above its value from ~3 days ago, or -20% hard stop.
 * When it does NOT work: in a choppy range where VIX oscillates the gate flickers; a liquidity-driven
 * BTC pump with flat VIX is missed; the hard stop can be hit by a sharp intra-trend shakeout.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const vix = ctx.data('base.vix');
  if (vix == null) return null;

  // keep a daily-deduped history of VIX (daily series, same value repeats for 6 bars)
  let hist = ctx.state.vixHist || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (last === null || Math.abs(last - vix) > 1e-9) {
    hist = hist.concat([vix]);
    if (hist.length > 30) hist = hist.slice(-30);
    ctx.state.vixHist = hist;
  }
  if (hist.length < 5) return null; // need a few daily values to measure change
  // VIX falling = today below the value from ~3 days ago (smoothed change, not noise)
  const vix3ago = hist[hist.length - 4];
  if (vix3ago == null) return null;
  const vixFalling = vix < vix3ago;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + VIX falling', conds:[
      { label:'VIX falling', ok: vixFalling }
    ]},
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up || !vixFalling) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (up && vixFalling) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
