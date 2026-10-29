/*
 * @coinsori-strategy v1
 * name: BTC Uptrend Dip-Buy Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a rising market, sharp dips to the lower Bollinger band
 * with an oversold RSI tend to snap back to the middle band. This is mean
 * reversion — the opposite family of the price-breakout champion: it buys
 * weakness instead of strength, and it only buys when the 200-day trend is still
 * up so it is not catching a falling knife.
 * When it buys and sells: Buys when the previous close is below the lower
 * Bollinger(20,2) band, RSI(14) is below 30, and price is above the 200-day
 * average. Sells when price returns to the 20-day average, or if price falls 12%
 * below entry.
 * When it does NOT work: In a genuine bear market the 200-day filter keeps us
 * mostly out, but a dip-buy during a slow grind lower still loses. It also misses
 * strong one-way rallies that never pull back to the lower band.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma20 = ctx.sma(20, 1);
  if (bb == null || rsi == null || sma200 == null || sma20 == null) return null;

  const pos = ctx.position;
  const entry = ctx.entryPx != null ? ctx.entryPx : (ctx.state && ctx.state.entryPx);

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'dip to BB lower', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'price>SMA200', ok: price > sma200 }] },
    { side: 'sell', price: sma20, trigger: 'above', note: 'return to mid-band' },
    { side: 'sell', note: '12% hard stop', conds: [{ label: 'price vs entry', ok: entry != null && price < entry * 0.88 }] }
  ]);

  if (pos > 0) {
    if (price > sma20) return { side: 'sell', qty: pos, reduceOnly: true };
    if (entry != null && price < entry * 0.88) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;
  if (rsi < 30 && price < bb.lower && price > sma200) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
