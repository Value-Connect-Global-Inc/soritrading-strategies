/*
 * @coinsori-strategy v1
 * name: BTC 4h USD-Regime Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that typically struggles when the US dollar strengthens
 * (tighter global liquidity) and rallies when the dollar weakens. This tests whether a dollar-strength
 * regime gate — a different macro axis than the yield-curve gate of the champion — keeps the same
 * trend-following shell out of the worst drawdowns.
 * When it buys: EMA50 above EMA200 (uptrend) AND the broad US dollar index below its own ~60-day mean
 * (weak-dollar regime).
 * When it sells: the EMA50/200 trend breaks, or a -20% hard stop below entry.
 * When it does NOT work: the dollar index is slow (10-day lag) so it cannot time fast turns; in periods
 * where crypto rallies despite a strong dollar (e.g. pure liquidity-driven bull markets) it stays in
 * cash and misses the move.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const usd = ctx.data('base_usd_broad'); // nominal broad US dollar index
  if (usd == null) return null;

  // rolling ~60-day history of the daily dollar index (same value repeats for 6 bars on 4h)
  let uHist = ctx.state.uHist || [];
  const uLast = uHist.length ? uHist[uHist.length - 1] : null;
  if (uLast === null || Math.abs(uLast - usd) > 1e-9) {
    uHist = uHist.concat([usd]);
    if (uHist.length > 60) uHist = uHist.slice(-60);
    ctx.state.uHist = uHist;
  }
  if (uHist.length < 40) return null; // need ~40 daily values for a stable mean
  const uMean = uHist.reduce((a, b) => a + b, 0) / uHist.length;
  const dollarWeak = usd < uMean; // weak dollar = risk-on for BTC

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + weak USD', conds:[
      { label:'USD<own mean', ok: dollarWeak }
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
  // enter on a weak-dollar regime inside an uptrend
  if (up && dollarWeak) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
