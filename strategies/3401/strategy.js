/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 1D
 * ex: binanceusdm
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A genuinely different signal source — futures funding rates.
 * Funding is what longs pay shorts (positive) or shorts pay longs (negative) to
 * keep the perpetual price anchored. Very positive funding means the crowd is
 * crowded long (risk rises); negative funding means shorts pay longs (a squeeze
 * is likely). Hypothesis: buying when funding is negative and selling when it
 * turns strongly positive captures the mean-reversion of crowded positioning.
 * When it buys and sells: buys when funding is negative (crowd short) and price
 * is above its 200-day average; sells when funding turns strongly positive
 * (crowd long) or price falls 2.5 ATR below entry.
 * When it does NOT work: In a persistent bull funding stays positive for months
 * and the strategy never buys — it misses the trend. In a persistent bear it
 * stays in cash. Funding data may be missing for some intervals — then it does
 * nothing (no trades, no loss).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  if (closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0) return null;

  const funding = ctx.funding;
  const fOk = funding != null && Number.isFinite(funding);

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    const crowdLong = fOk && funding > 0.0008;   // 0.08% per bar = crowded long, take profit
    if (crowdLong || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  const crowdShort = fOk && funding < 0;         // negative funding = shorts pay longs = crowd short
  const uptrend = sma200 != null && prevClose > sma200;
  if (crowdShort && uptrend) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
