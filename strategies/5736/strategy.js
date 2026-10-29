/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd emotion. When it is
 * extremely low the crowd is panicking — historically a good time to buy BTC if
 * the long-term trend is still up. When it is very high the crowd is euphoric —
 * a good time to take profits. This is a sentiment-contrarian family, the
 * opposite of the price-breakout champion.
 * When it buys and sells: Buys when the index drops below 25 AND price is above
 * its 200-day average (an uptrend pullback, not a falling knife). Sells when the
 * index rises above 60, or if price falls 15% below entry.
 * When it does NOT work: In a prolonged bear market (2018, 2022) fear stays high
 * for months and price keeps falling — the 200-day filter keeps us out, but if a
 * bear starts while we are long the 15% stop is our only protection. It also sits
 * out calm bull years when fear never gets extreme, missing the run entirely.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // unknown sentiment, do not trade
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const pos = ctx.position;
  const entry = ctx.entryPx;

  // No fixed price level exists for a sentiment signal, so we declare the
  // conditions we ACTUALLY used (the card shows them; watch() is display only).
  const buyCond = { label: 'F&G', now: fg, op: '<', ref: 25, closed: true };
  const trendCond = { label: 'price>SMA200', ok: sma200 != null && price > sma200 };
  ctx.watch([
    { side: 'buy', note: 'extreme fear + uptrend', conds: [buyCond, trendCond] },
    { side: 'sell', note: 'greed exit', conds: [{ label: 'F&G', now: fg, op: '>', ref: 60, closed: true }] },
    { side: 'sell', note: '15% hard stop', conds: [{ label: 'price vs entry', ok: entry != null && price < entry * 0.85 }] }
  ]);

  if (pos > 0) {
    if (fg > 60) return { side: 'sell', qty: pos, reduceOnly: true };
    if (entry != null && price < entry * 0.85) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;
  if (fg < 25 && sma200 != null && price > sma200) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
