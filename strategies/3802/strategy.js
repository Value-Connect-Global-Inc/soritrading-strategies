/*
 * @coinsori-strategy v1
 * name: FundingContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: funding rate measures the cost of holding a long vs a short.
 * Deeply negative funding means longs flushed out — contrarian buy. Strongly
 * positive funding means crowded longs — exit.
 * When it buys and sells: Buy when funding < -0.02% and price above its 100-day
 * average. Sell when funding > +0.02%, price breaks the 100-day average, or a
 * 20% hard stop.
 * When it does NOT work: persistent bear market (no trades, correct but idle);
 * flat markets where funding never reaches extremes.
 */
function onUpdate(ctx) {
  const funding = ctx.funding;
  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) return null;

  const prevClose = ctx.closes.at(-2);
  const trendUp = prevClose > sma100;
  const flushed = funding != null && funding < -0.0002;
  const crowded = funding != null && funding > 0.0002;

  ctx.watch([
    { side:'buy', price: sma100, trigger:'above', note:'SMA100 break up',
      conds:[{ label:'funding < -0.02%', now: funding, op:'<', ref:-0.0002, closed:true }] },
    { side:'sell', price: sma100, trigger:'below', note:'SMA100 break down' }
  ]);

  const pos = ctx.position || 0;

  if (pos === 0) {
    if (trendUp && flushed) {
      return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    return null;
  }

  // hard stop: 20% below entry caps tail risk on a long-only position
  if (ctx.entryPx != null && ctx.price < ctx.entryPx * 0.80) {
    return { side:'sell', qty: pos };
  }
  if (crowded || !trendUp) {
    return { side:'sell', qty: pos };
  }
  return null;
}
