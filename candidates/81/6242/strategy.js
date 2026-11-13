/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding is a crowd-positioning gauge. Very negative funding
 * means shorts are crowded (a contrarian buy), very positive funding means longs are crowded
 * (a contrarian sell). This fades those extremes instead of following price.
 * When it buys and sells: buy when funding is below -0.03% while price is above its EMA100
 * (uptrend, not catching a knife); sell (short) when funding is above +0.03% while price is
 * below EMA100. Exit when funding crosses back to the other side, or the 3x ATR stop is hit.
 * When it does NOT work: in a persistent one-way trend funding stays extreme and the fade
 * keeps losing until the stop; in quiet markets funding never reaches the extremes so it
 * just sits in cash. Funding is a perp-only signal — this only runs on perpetuals.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const funding = ctx.funding;
  const ema100 = ctx.ema(100, 1);
  const atr = ctx.atr(14, 1);
  if (ema100 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);

  // ---- exits (funding mean-reversion done, or hard stop) ----
  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    const fundingDone = funding != null && funding >= 0; // crowded-short fade done once funding is no longer negative
    if (fundingDone || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'funding/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }
  if (pos < 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx + 3 * atr : null;
    const fundingDone = funding != null && funding <= 0;
    if (fundingDone || (stop != null && close > stop)) {
      ctx.watch([{ side: 'buy', price: stop != null ? stop : close, trigger: 'above', note: 'funding/stop exit' }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'buy', price: stop != null ? stop : close, trigger: 'above', note: '3x ATR stop' }]);
    return null;
  }

  // ---- entries: fade funding extremes, only with the trend ----
  if (funding == null) {
    ctx.watch([]);
    return null;
  }
  if (funding < -0.0003 && close > ema100) { // -0.03% = crowded shorts
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy', price: close, trigger: 'above', note: 'crowded-short buy',
      conds: [{ label: 'funding rate', now: funding, op: '<', ref: -0.0003, closed: true }]
    }]);
    return { side: 'buy', qty: qty };
  }
  if (funding > 0.0003 && close < ema100) { // +0.03% = crowded longs
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'sell', price: close, trigger: 'below', note: 'crowded-long short',
      conds: [{ label: 'funding rate', now: funding, op: '>', ref: 0.0003, closed: true }]
    }]);
    return { side: 'sell', qty: qty };
  }

  ctx.watch([]);
  return null;
}
