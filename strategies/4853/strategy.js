/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian v1
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crowd sentiment extremes in crypto tend to mean-revert — deep fear marks
 * washout lows, extreme greed marks tops. The Fear & Greed index (0-100) is a daily sentiment
 * score, so it is a different signal axis from price momentum.
 * When it buys and sells: it buys BTC when the index is at extreme fear (< 25) and sells when it
 * reaches extreme greed (> 70) or price falls 15% below the average entry (hard stop against a
 * prolonged fear spell). Cash otherwise.
 * When it does NOT work: in a grinding bear (2018, 2022) fear stays extreme for months — the 15%
 * stop cuts the position and the strategy idles in cash while price keeps falling; in a melt-up
 * that never cools below 25 it never enters and misses the whole rally.
 */
function onUpdate(ctx) {
  const px = ctx.closes.at(-2); // last CLOSED bar — identical in backtest, paper and live
  if (px == null) return null;
  const fg = ctx.data('fear_greed'); // 0-100 daily sentiment score
  if (fg == null) return null; // no data before 2018-02 — stay flat

  const pos = ctx.position;
  const entry = ctx.entryPx;

  if (pos > 0) {
    const stop = entry != null ? entry * 0.85 : null; // hard stop: -15% below average entry
    if (stop != null) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '-15% stop',
                   conds: [{ label: 'FG index', now: fg, op: '>', ref: 70, closed: true }] }]);
    }
    if (fg > 70 || (stop != null && px < stop)) { // greed exit or stop-out
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // entry has no price condition (it is a sentiment level) — no watch to declare when flat
  if (fg < 25) { // extreme fear = washout zone, historically a good long entry
    const qty = (ctx.cash / px) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
