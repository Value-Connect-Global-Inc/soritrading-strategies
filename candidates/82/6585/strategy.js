/*
 * @coinsori-strategy v1
 * name: BTC YieldCurve Regime Long 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Long-only Bitcoin trend with a yield-curve risk gate.
 * Why: an inverted US yield curve (10Y below 2Y) has preceded every recent recession — a risk-off signal for stocks and crypto; a positive curve is the normal risk-on regime.
 * When it buys: BTC above a rising SMA200 and the 10Y-2Y spread is positive. When it sells: BTC breaks below SMA200, the spread turns deeply negative (< -0.25), or a 4xATR stop is hit.
 * When it does NOT work: monster bull markets where holding the whole move beats any timing; long flat periods where the trend filter whipsaws.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma1 = ctx.sma(200, 1);
  const sma2 = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  const curve = ctx.data('base_t10y2y');
  if (sma1 == null || sma2 == null || atr == null || curve == null) return null;

  const trendUp = price > sma1 && sma1 > sma2;
  const riskOn = curve > 0;        // positive curve = normal risk-on regime
  const riskOff = curve < -0.25;   // deep inversion = recession risk-off

  if (ctx.position <= 0) {
    ctx.watch([{ side:'buy', price: sma1, trigger:'above', note:'SMA200 rising', conds:[{ label:'Yield curve positive', now: curve, op:'>', ref:0, closed:true }] }]);
    if (trendUp && riskOn) {
      return { side:'buy', qty: ctx.cash / price * 0.95 };
    }
    return null;
  }

  // 4xATR stop: wide enough to survive 4h noise, tight enough to cap a crash.
  const stop = ctx.entryPx == null ? null : ctx.entryPx - 4 * atr;
  const watch = [];
  if (stop != null) watch.push({ side:'sell', price: stop, trigger:'below', note:'4xATR stop' });
  watch.push({ side:'sell', price: sma1, trigger:'below', note:'SMA200 break', conds:[{ label:'Curve deeply inverted', now: curve, op:'<', ref:-0.25, closed:true }] });
  ctx.watch(watch);

  if (riskOff || price < sma1) {
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  if (stop != null && price <= stop) {
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
