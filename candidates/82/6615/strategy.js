/*
 * @coinsori-strategy v1
 * name: BTC 4h USD-Weakness Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is priced in dollars and behaves as an anti-dollar asset. When the
 * US dollar is WEAK (below its own recent average), global liquidity is loose and BTC uptrends
 * tend to extend. We use the USD Broad Index relative to its own ~60-day mean, not a fixed
 * level, so the filter stays valid across dollar regimes.
 * When it buys: EMA50 above EMA200 (uptrend) AND the USD index below its own 60-day mean (weak dollar).
 * When it sells: the trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: in a crypto-specific pump with a strong dollar it stays out and misses
 * upside; the 10-day data lag makes the gate react slowly to sudden dollar turns; a weak dollar
 * does not protect you during a crypto bear (2022) — the trend exit must do that.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const usd = ctx.data('base_usd_broad');
  if (usd == null) return null;

  // rolling ~60-day history of the USD index (daily series, same value repeats for 6 bars on 4h)
  let hist = ctx.state.uHist || [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (last === null || Math.abs(last - usd) > 1e-9) {
    hist = hist.concat([usd]);
    if (hist.length > 60) hist = hist.slice(-60);
    ctx.state.uHist = hist;
  }
  if (hist.length < 40) return null; // need ~40 daily values for a stable mean
  const uMean = hist.reduce((a, b) => a + b, 0) / hist.length;
  // risk-on = weak dollar (USD index below its own recent mean)
  const riskOn = usd < uMean;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + weak USD', conds:[
      { label:'USD<own mean', ok: riskOn }
    ]},
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (up && riskOn) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
