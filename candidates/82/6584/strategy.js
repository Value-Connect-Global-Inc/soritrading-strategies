/*
 * @coinsori-strategy v1
 * name: ETH VIX-Regime Long Trend 4h
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Long-only trend following on Ethereum with a macro risk gate.
 * Why: when VIX is calm (risk-on) and price is above a rising long-term average, crypto uptrends are strongest; elevated VIX marks the risk-off periods where altcoin drawdowns are deepest.
 * When it buys: price above a rising SMA200 and VIX below 25. When it sells: price below SMA200, VIX above 30, or a 3xATR stop is hit.
 * When it does NOT work: monster bull markets where holding the entire move beats any timing, and flat chop that whipsaws the trend filter.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma1 = ctx.sma(200, 1);
  const sma2 = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  const vix = ctx.data('base_vix');
  if (sma1 == null || sma2 == null || atr == null || vix == null) return null;

  const trendUp = price > sma1 && sma1 > sma2;
  const calm = vix < 25;      // risk-on regime (VIX below 25 = calm)
  const riskOff = vix > 30;   // risk-off regime (VIX above 30 = stress)

  if (ctx.position <= 0) {
    ctx.watch([{ side:'buy', price: sma1, trigger:'above', note:'SMA200 rising', conds:[{ label:'VIX calm', now: vix, op:'<', ref:25, closed:true }] }]);
    if (trendUp && calm) {
      return { side:'buy', qty: ctx.cash / price * 0.95 };
    }
    return null;
  }

  // 3xATR stop: 3 bars of 4h range gives room to breathe while capping a single loss.
  const stop = ctx.entryPx == null ? null : ctx.entryPx - 3 * atr;
  const watch = [];
  if (stop != null) watch.push({ side:'sell', price: stop, trigger:'below', note:'3xATR stop' });
  watch.push({ side:'sell', price: sma1, trigger:'below', note:'SMA200 break', conds:[{ label:'VIX risk-off', now: vix, op:'>', ref:30, closed:true }] });
  ctx.watch(watch);

  if (riskOff || price < sma1) {
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  if (stop != null && price <= stop) {
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
