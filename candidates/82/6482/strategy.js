/*
 * @coinsori-strategy v1
 * name: BTC Trend + Funding De-Risk 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Price trend with a positioning guard: on perpetuals, funding is the price
 * longs pay shorts every 8h. When funding is extremely high the market is
 * crowded long and a blow-off top is near; we refuse to buy into that and we
 * take profit when it happens.
 * When it buys and sells: LONG when close is above EMA50 (uptrend) AND funding
 * is below a high threshold (not max greed). Exit on a close below EMA50, a
 * 3xATR stop, or funding above the extreme-greed level.
 * When it does NOT work: in a fast one-way bull, funding stays high for a long
 * time so the filter keeps us out of strong legs (missed upside); in a bear,
 * the EMA50 filter alone cannot protect against a sharp crash between bars.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  const funding = ctx.funding; // null if unavailable
  if (ema50 == null || atr == null) { ctx.watch([]); return null; }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // funding thresholds: Binance typical funding is ~0.01% per 8h.
  // 0.05% = clearly above normal (crowded long building); 0.10% = extreme greed (blow-off).
  const MAX_ENTRY_FUNDING = 0.0005;   // do not buy into >5x normal funding
  const EXIT_FUNDING = 0.0010;        // take profit when funding hits ~10x normal

  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) ctx.state.skipUntil = ctx.i + 6;
  ctx.state.lastPos = pos;

  const alloc = ctx.alloc;
  let forcedRecent = false;
  if (ctx.state._forcedSeen != null && ctx.i - ctx.state._forcedSeen <= 6) forcedRecent = true;
  const afterForced = forcedRecent || (ctx.state.skipUntil != null && ctx.i <= ctx.state.skipUntil);
  const allocOk = (alloc == null || alloc.status === 'ok') && !afterForced;
  if (!allocOk) { ctx.watch([]); return null; }

  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema50, trigger: 'below', note: 'close<EMA50' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'funding extreme', conds: funding == null ? [] : [{ label: 'funding>0.10%', now: funding, op: '>', ref: EXIT_FUNDING, closed: true }] }
    ]);
    if (funding != null && funding > EXIT_FUNDING) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const uptrend = prevClose != null && prevClose > ema50;
  const notCrowded = funding == null || funding < MAX_ENTRY_FUNDING; // null = unknown -> allow, don't block on missing data
  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'above', note: 'long', conds: funding == null ? [] : [{ label: 'funding<0.05%', now: funding, op: '<', ref: MAX_ENTRY_FUNDING, closed: true }] }
  ]);
  if (!(uptrend && notCrowded)) return null;

  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
