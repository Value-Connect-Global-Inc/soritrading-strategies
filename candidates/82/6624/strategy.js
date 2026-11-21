/*
 * @coinsori-strategy v1
 * name: BTC 4h Funding Capitulation
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: When funding turns deeply negative on the perpetual, shorts are crowded and every
 * long earns funding — and a price capitulation (down 15% from the 20-day high) is when the crowd is
 * most one-sided. This is a sentiment/positioning play, a different family from the NDX trend champion
 * and from mean reversion: it buys the panic and exits when the crowd normalizes (funding back to 0).
 * When it buys: funding below -0.05% per 8h (crowded shorts) AND price at least 15% below its 20-day
 * high (capitulation).
 * When it sells: funding returns to 0 or above (crowd normalized), or a -12% hard stop.
 * When it does NOT work: in a sustained crash, funding can stay deeply negative for months while price
 * keeps falling — the stop is what keeps a single knife-catch from hurting, but repeated knife-catches
 * bleed; and in a strong bull that never capitulates it simply never trades.
 */
function onUpdate(ctx) {
  const f = ctx.funding; // current funding rate per 8h (fraction), null if unavailable
  if (f == null) return null;
  const hh = ctx.high(80, 1); // highest high over 80 bars (20 days on 4h), closed bar
  if (hh == null) return null;
  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const capLevel = hh * 0.85; // 15% below the 20-day high = capitulation
  const stop = entry != null ? entry * 0.88 : 0;

  const watchList = [];
  if (pos === 0) {
    watchList.push({ side:'buy', price: capLevel, trigger:'below', note:'panic + neg funding', conds:[{label:'funding< -0.05%', ok: f < -0.0005}] });
  } else {
    watchList.push({ side:'sell', price: price, trigger:'above', note:'funding back to 0', conds:[{label:'funding>=0', ok: f >= 0}] });
    watchList.push({ side:'sell', price: stop, trigger:'below', note:'hard stop' });
  }
  ctx.watch(watchList);

  if (pos > 0 && entry != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (f >= 0) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (pos === 0 && f < -0.0005 && price <= capLevel) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
