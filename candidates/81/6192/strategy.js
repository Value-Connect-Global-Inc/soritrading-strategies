/*
 * @coinsori-strategy v1
 * name: BTC Perp Funding Contrarian (usdm)
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding is a direct measure of crowd positioning. When funding
 * is very negative, shorts are paying longs to hold — a crowded short that usually gets
 * squeezed higher. When funding is very positive, longs are paying shorts — a crowded long
 * that usually gets dumped. Trading against these extremes is a sentiment mean-reversion
 * that is independent of price patterns (a different family from all price-based ideas).
 * When it buys and sells: Go long when funding is below -0.03% (crowded shorts), go short
 * when funding is above +0.05% (crowded longs). Close when funding normalizes (|funding| <
 * 0.01%) or a 15% hard stop is hit. Long/short on the perpetual at 1x.
 * When it does NOT work: In a strong one-way trend funding stays extreme for weeks and the
 * contrarian side keeps losing — the stop caps each loss but repeated against-trend trades
 * add up. If no funding history exists the strategy simply does nothing.
 */
function onUpdate(ctx) {
  const funding = ctx.funding;
  const prevClose = ctx.closes.at(-2);
  if (funding == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position !== 0) {
    const long = ctx.position > 0;
    const stop = ctx.entryPx != null ? (long ? ctx.entryPx * 0.85 : ctx.entryPx * 1.15) : null;
    ctx.watch([
      ...(stop != null ? [{ side: long ? 'sell' : 'buy', price: stop, trigger: long ? 'below' : 'above', note: '15% hard stop' }] : []),
      // The funding-normalized exit has no price level (it is a funding condition, not a price).
      { side: long ? 'sell' : 'buy', price: prevClose, trigger: long ? 'below' : 'above', note: 'funding normalized', conds: [{ label: '|funding|<0.01%', ok: Math.abs(funding) < 0.0002 }] }
    ]);
    if (stop != null && long && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && !long && prevClose > stop) return { side: 'buy', qty: Math.abs(ctx.position), reduceOnly: true };
    if (Math.abs(funding) < 0.0002) {
      return long ? { side: 'sell', qty: ctx.position, reduceOnly: true } : { side: 'buy', qty: Math.abs(ctx.position), reduceOnly: true };
    }
    return null;
  }

  // Flat: no new entries while the allocator is in reduce-only mode.
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (funding < -0.0003) {
    ctx.watch([{ side: 'buy', price: prevClose, trigger: 'above', note: 'crowded short', conds: [{ label: 'funding<-0.03%', now: funding, op: '<', ref: -0.0003, closed: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  if (funding > 0.0005) {
    ctx.watch([{ side: 'sell', price: prevClose, trigger: 'below', note: 'crowded long', conds: [{ label: 'funding>0.05%', now: funding, op: '>', ref: 0.0005, closed: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'sell', qty: qty };
  }
  ctx.watch([]);
  return null;
}
