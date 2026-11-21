/*
 * @coinsori-strategy v1
 * name: BTC 4h VIX Regime Trend Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades like a risk asset — its crashes concentrate in
 * periods when equity volatility (VIX) is elevated, and its best rallies happen when
 * volatility is calm. Using VIX as a regime gauge (z-score vs its own recent mean,
 * not a fixed level) tells us whether the macro tape is risk-on or risk-off.
 * When it buys: price above its 200-bar average (long-term uptrend) AND VIX calm
 * (z-score below 0.5).
 * When it sells: price falls back below the 200-bar average, a VIX spike to extreme
 * risk-off (z-score above 2) while underwater, or a -20% hard stop below entry.
 * When it does NOT work: VIX is a 2-day-lagged, weekly macro number — it cannot time
 * fast crypto-specific moves, so a sharp BTC crash that VIX has not yet registered
 * still hits the -20% stop; and in a long calm-VIX bear (slow bleed) the strategy
 * keeps buying dips that keep falling.
 */
function onUpdate(ctx) {
  const vix = ctx.data('base_vix');
  if (vix == null) return null;
  const s200 = ctx.sma(200, 1);
  if (s200 == null) return null;

  // Rolling VIX history for a z-score vs its own mean (regime shape, not a fixed level).
  const hist = Array.isArray(ctx.state.vixHist) ? ctx.state.vixHist : [];
  hist.push(vix);
  if (hist.length > 200) hist.shift();
  ctx.state.vixHist = hist;
  let vz = null;
  if (hist.length >= 60) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
    if (sd > 0.01) vz = (vix - mean) / sd;
  }
  if (vz == null) return null;

  const price = ctx.price;
  const inPos = ctx.position > 0;
  const up = price > s200;
  const entryPx = ctx.entryPx;
  const stop = entryPx != null ? entryPx * 0.8 : 0;
  const vixExit = vz > 2 && entryPx != null && price < entryPx;

  ctx.watch([
    { side:'buy', price: s200, trigger:'above', note:'uptrend, calm VIX', conds:[{label:'VIX z', now: vz, op:'<', ref: 0.5, closed:true}] },
    ...(inPos ? [
      { side:'sell', price: s200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' },
      ...(entryPx != null ? [{ side:'sell', price: entryPx, trigger:'below', note:'VIX spike risk-off', conds:[{label:'VIX z', now: vz, op:'>', ref: 2, closed:true}] }] : [])
    ] : [])
  ]);

  if (inPos && entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (!up) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (vixExit) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (up && vz < 0.5) {
    return { side:'buy', qty: (ctx.cash + ctx.position * price) / price * 0.99 };
  }
  return null;
}
