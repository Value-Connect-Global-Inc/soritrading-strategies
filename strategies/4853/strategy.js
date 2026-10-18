/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian v3 (deep fear, early exit)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: extreme fear in crypto marks washout lows that later recover to neutral — the
 * mean reversion is from fear to neutral, not all the way to greed. Buying at deep fear (index < 15)
 * in an uptrend gets a better price, and selling as soon as sentiment recovers to neutral (index > 50)
 * banks the reversion before the next pullback.
 * When it buys and sells: it buys BTC when the index is below 15 AND price is above the 200-day
 * average (long-term uptrend intact). It sells when the index climbs back above 50 or price falls
 * 20% below the average entry (wide stop — crypto needs room to breathe).
 * When it does NOT work: in a grinding bear the 200-day filter keeps it out (safe, no profit); in a
 * melt-up that never cools below 15 it never enters and misses the rally; a genuine crash that takes
 * price 20% below entry still stops it out before the bottom.
 */
function onUpdate(ctx) {
  const px = ctx.closes.at(-2); // last CLOSED bar — identical in backtest, paper and live
  if (px == null) return null;
  const fg = ctx.data('fear_greed'); // 0-100 daily sentiment score
  const sma200 = ctx.sma(200, 1); // long-term trend filter on closed bars
  if (fg == null || sma200 == null) return null; // no data yet — stay flat

  const pos = ctx.position;
  const entry = ctx.entryPx;

  if (pos > 0) {
    const stop = entry != null ? entry * 0.80 : null; // wide stop: -20% below average entry
    if (stop != null) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '-20% stop',
                   conds: [{ label: 'FG index', now: fg, op: '>', ref: 50, closed: true }] }]);
    }
    if (fg > 50 || (stop != null && px < stop)) { // sentiment back to neutral, or stop-out
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (fg < 15 && px > sma200) { // deep fear + uptrend = washout low to buy
    const qty = (ctx.cash / px) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
