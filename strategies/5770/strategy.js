/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Funding rate measures the cost of holding leveraged positions. When funding is extremely
 * negative, shorts are paying longs heavily — the market is crowded short and a squeeze higher is likely.
 * This is positioning data that price alone cannot see.
 * When it buys and sells: Buy when funding is very negative (crowded short) while the longer trend is up
 * (200-bar average rising) and price is below its 50-bar average (a dip within the uptrend). Sell when funding
 * climbs back above zero, or on a 12% hard stop.
 * When it does NOT work: In a persistent bear market the rising-trend gate keeps it out (good). But a bull that
 * never shows negative funding is missed, and a sharp V-reversal down can hit the stop before the squeeze plays out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const funding = ctx.funding;
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma200prev == null) return null;

  // funding is a number (rate per 8h). Guard null.
  const f = (typeof funding === 'number') ? funding : null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop
    ctx.watch([
      { side: 'sell', price: 0, trigger: 'above', note: 'funding back above 0' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% hard stop' }
    ]);
    if (f != null && f > 0) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null && price < entryPx * 0.88) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: extreme negative funding (crowded short) + price below SMA50 (dip) + SMA200 rising (uptrend gate).
  // Threshold -0.0005% per 8h = clear short-crowding, common enough to trade but rare enough to be meaningful.
  // The trend gate keeps us out of bear markets where negative funding is a falling knife, not a squeeze setup.
  const trendUp = sma200 > sma200prev;
  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'below', note: 'dip + extreme short funding', conds: [
      { label: 'funding', now: f, op: '<', ref: -0.00005, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]}
  ]);
  if (f != null && f < -0.00005 && price < sma50 && trendUp) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
  }

  return null;
}
