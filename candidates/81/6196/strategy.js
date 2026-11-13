/*
 * @coinsori-strategy v1
 * name: BTC Dual-Direction Trend 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Trend-following that trades BOTH directions on BTC perpetuals: it buys in
 * uptrends and shorts in downtrends, so it can make money in falling markets
 * where long-only strategies lose. Uses the EMA50/EMA200 pair to define the
 * trend and requires the two to be clearly separated (dead zone) so it does
 * not trade in barely-defined chop. An ATR stop survives crashes.
 * When it buys and sells: long when price crosses above EMA50 and EMA50 is at
 * least 1% above EMA200; short when price crosses below EMA50 and EMA50 is at
 * least 1% below EMA200; exit on the opposite EMA200 cross or a 2.5xATR stop.
 * When it does NOT work: long sideways chop that never separates the EMAs, and
 * straight-up parabolic bulls where holding beats any trader that is ever
 * short or out of the market.
 */
function onUpdate(ctx) {
  // Regime + momentum read from CLOSED bars so backtest/paper/live match.
  const e50 = ctx.ema(50, 1);
  const e50p = ctx.ema(50, 2);
  const e200 = ctx.ema(200, 1);
  const e200p = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (e50 == null || e50p == null || e200 == null || e200p == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  const prevPrevClose = ctx.closes.at(-3);
  if (prevClose == null || prevPrevClose == null) return null;

  const sep = 0.01; // 1% dead zone: don't trade until the trend is clearly established
  const longTrend = e50 > e200 * (1 + sep);
  const shortTrend = e50 < e200 * (1 - sep);
  // Clean cross on the last closed bar only (no re-entry churn).
  const crossUp = prevPrevClose <= e50p && prevClose > e50;
  const crossDown = prevPrevClose >= e50p && prevClose < e50;

  const stopMult = 2.5; // ATR stop: wide enough to survive noise, tight enough to cut crashes
  const watch = [];
  let order = null;

  if (pos === 0) {
    if (longTrend && crossUp) {
      order = { side: 'buy', qty: (ctx.cash / price) * 0.98 };
    } else if (shortTrend && crossDown) {
      order = { side: 'sell', qty: (ctx.cash / price) * 0.98 };
    }
    watch.push({ side: 'buy', price: e50, trigger: 'above', note: 'EMA50 cross up', conds: [{ label: 'EMA50>1% over EMA200', ok: longTrend }] });
    watch.push({ side: 'sell', price: e50, trigger: 'below', note: 'EMA50 cross down', conds: [{ label: 'EMA50>1% under EMA200', ok: shortTrend }] });
  } else if (pos > 0) {
    const ep = ctx.entryPx;
    const stop = ep == null ? null : ep - stopMult * atr;
    watch.push({ side: 'sell', price: e200, trigger: 'below', note: 'trend exit' });
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
    if (prevClose < e200 || (stop != null && price <= stop)) {
      order = { side: 'sell', qty: pos, reduceOnly: true };
    }
  } else { // short position
    const ep = ctx.entryPx;
    const stop = ep == null ? null : ep + stopMult * atr;
    watch.push({ side: 'buy', price: e200, trigger: 'above', note: 'trend exit' });
    if (stop != null) watch.push({ side: 'buy', price: stop, trigger: 'above', note: 'ATR stop' });
    if (prevClose > e200 || (stop != null && price >= stop)) {
      order = { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
  }

  ctx.watch(watch);
  return order;
}
