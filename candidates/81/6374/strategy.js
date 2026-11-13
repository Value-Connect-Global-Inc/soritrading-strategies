/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In perpetual futures the funding rate shows which side the crowd is on.
 * Deeply negative funding means shorts are paying longs (crowded short) and a squeeze upward
 * is likely; deeply positive funding means a crowded long and a pullback is likely. We fade
 * the crowd, and only act when price agrees with the trend so we do not catch a falling knife.
 * When it buys and sells: Buys (long) when funding is very negative AND price is above its
 * 50-bar average; sells and goes short when funding is very positive AND price is below its
 * 50-bar average. Exits when funding returns to neutral or a 5% stop is hit.
 * When it does NOT work: In a strong one-way trend funding can stay extreme while price keeps
 * moving against the crowded side — fading it then loses repeatedly. It also sits in cash
 * much of the time, so in a straight bull market it earns far less than holding.
 */
function onUpdate(ctx) {
  const f = ctx.funding;
  const sma50 = ctx.sma(50, 1);   // closed-bar trend guard
  if (f == null || sma50 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;

  // funding thresholds, fraction per 8h (0.0001 = 0.01%): extreme crowd reads
  const F_LONG = -0.0003;    // crowd deeply short -> buy
  const F_SHORT = 0.0003;    // crowd deeply long -> sell/short
  const F_FLAT = 0.00005;    // funding near neutral -> exit

  // 5% hard stop on every position (usdm: long stop below, short stop above)
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.95 : null;
  const stopShort = ctx.entryPx != null ? ctx.entryPx * 1.05 : null;

  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'above', note: 'long entry', conds: [{ label: 'funding< -0.03%', ok: f < F_LONG }] },
    { side: 'sell', price: sma50, trigger: 'below', note: 'short entry', conds: [{ label: 'funding> +0.03%', ok: f > F_SHORT }] },
    { side: 'sell', price: stop, trigger: 'below', note: 'long stop' },
    { side: 'buy', price: stopShort, trigger: 'above', note: 'short stop' }
  ]);

  if (pos > 0) {
    if (f >= F_FLAT || (stop != null && price <= stop)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    if (f <= -F_FLAT || (stopShort != null && price >= stopShort)) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }
  // flat: fade the crowd only when price agrees with the trend direction
  if (f < F_LONG && price > sma50) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  if (f > F_SHORT && price < sma50) {
    return { side: 'sell', qty: (ctx.cash / price) * 0.99 };   // open short on usdm
  }
  return null;
}
