/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is driven heavily by crowd emotion. When the
 * Fear & Greed index is at extreme fear, the crowd is panicking and prices
 * are often oversold; when it is at extreme greed, the crowd is euphoric
 * and prices are often overheated. Buying fear and selling greed is a
 * mean-reversion bet on crowd psychology.
 * When it buys and sells: buys when the Fear & Greed index is very low
 * (<= 20, extreme fear) while price is still above a long rising trend
 * (200-day SMA) so we only catch fear within an uptrend, not a real crash.
 * Sells when the index is very high (>= 75, extreme greed) or on a 25%
 * hard stop.
 * When it does NOT work: in a genuine bear market the "fear" buy keeps
 * catching falling knives because the 200-day SMA is also falling — the
 * trend filter helps but a deep bear still cuts. In a long euphoric bull
 * the greed-sell exits early and misses most of the ride.
 */
function onUpdate(ctx) {
  const fg = ctx.data('main.fear_greed');
  const sma200 = ctx.sma(200, 1);
  const entry = ctx.entryPx;
  const pos = ctx.position || 0;
  const price = ctx.price;

  // Need the index and the trend line; both can be null early on.
  if (fg == null || sma200 == null) {
    ctx.watch([]);
    return null;
  }

  // ---- while holding: exits ----
  if (pos > 0) {
    const stop = entry != null ? entry * 0.75 : null; // 25% hard stop
    ctx.watch([
      { side: 'sell', price: 75, trigger: 'above', note: 'Extreme greed exit', conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 75 }] },
      { side: 'sell', price: stop != null ? stop : price, trigger: 'below', note: 'Hard stop -25%' },
    ]);
    if (fg >= 75) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: buy extreme fear within an uptrend ----
  const trendUp = price > sma200; // only buy fear inside an uptrend
  ctx.watch([{
    side: 'buy', price: 20, trigger: 'below', note: 'Extreme fear entry',
    conds: [
      { label: 'F&G index', now: fg, op: '<=', ref: 20 },
      { label: 'Price > SMA200', ok: trendUp },
    ],
  }]);
  if (fg <= 20 && trendUp) {
    const qty = (ctx.cash / price) * 0.95;
    return { side: 'buy', qty: qty };
  }
  return null;
}
