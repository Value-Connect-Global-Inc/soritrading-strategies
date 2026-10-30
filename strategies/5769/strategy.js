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
 * This is positioning data that price alone cannot show.
 * When it buys and sells: Buy when funding is very negative (crowded short) while price is below its 50-bar
 * average (still a dip). Sell when funding climbs back above zero, or on a 12% hard stop.
 * When it does NOT work: In a persistent bear market, funding can stay negative for a long time while price
 * keeps falling — the contrarian long gets caught. Funding prints are sparse (every 8h), so entries are rare.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const funding = ctx.funding;
  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  // funding is a number (rate per 8h). Guard null.
  const f = (typeof funding === 'number') ? funding : null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop
    ctx.watch([
      { side: 'sell', price: 0, trigger: 'above', note: 'funding back above 0' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% hard stop' }
    ]);
    // Exit when funding turns positive (crowd back to neutral/long) or hard stop
    if (f != null && f > 0) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null && price < entryPx * 0.88) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: extreme negative funding (crowded short) while price is below its 50-bar average (dip)
  // -0.01% per 8h is a strong short-crowding signal for BTC; below SMA50 keeps us from buying tops.
  if (f != null && f < -0.0001 && price < sma50) {
    ctx.watch([
      { side: 'buy', price: sma50, trigger: 'below', note: 'dip below SMA50', conds: [
        { label: 'funding', now: f, op: '<', ref: -0.0001, closed: true }
      ]}
    ]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
  }

  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'below', note: 'dip + extreme short funding', conds: [
      { label: 'funding', now: f, op: '<', ref: -0.0001, closed: true }
    ]}
  ]);
  return null;
}
