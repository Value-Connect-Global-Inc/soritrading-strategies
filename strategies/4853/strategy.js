/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian v2 (trend-filtered)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crowd sentiment extremes mean-revert, but only when the longer trend is up —
 * fear inside an uptrend is a pullback to buy, fear inside a downtrend is a falling knife. The
 * Fear & Greed index (0-100) is a daily sentiment score, a different signal axis from price momentum.
 * When it buys and sells: it buys BTC when the index is at extreme fear (< 25) AND price is above the
 * 200-day average (long-term uptrend intact). It sells when the index reaches extreme greed (> 70) or
 * price falls 15% below the average entry (hard stop against a prolonged fear spell).
 * When it does NOT work: in a grinding bear the 200-day filter keeps it out (safe, no profit); in a
 * melt-up that never cools below 25 it never enters and misses the rally; a sharp bull correction
 * that dips below 25 but not below the 200-day still risks the 15% stop.
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

  if (fg < 25 && px > sma200) { // fear + uptrend = pullback, not knife
    const qty = (ctx.cash / px) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
