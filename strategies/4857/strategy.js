/*
 * @coinsori-strategy v1
 * name: BtcFearGreedContrarian1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed index is a crowd-sentiment gauge. Panic (extreme fear) inside
 * an intact long-term bull is a buying opportunity because the uptrend is still alive; this bets that
 * sentiment extremes mean-revert in crypto.
 * When it buys and sells: buys BTC when Fear & Greed is below 20 (extreme fear) AND price is above the
 * 200-day EMA (bull regime — the filter that keeps it out of a falling knife in a bear). Sells when
 * price falls 15% below its highest close since entry (trailing stop) or the position is down 20% from
 * entry (hard stop).
 * When it does NOT work: in a prolonged bear the 200-day filter keeps it in cash (no loss, no profit).
 * If a bull ends while it holds, the trailing stop gives back part of the gain. Extreme-fear days are
 * rare, so trades are few and it can sit in cash for months.
 */
function onUpdate(ctx) {
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const ema200 = ctx.ema(200, 1);
  const fg = ctx.data("fear_greed"); // 0-100 daily sentiment gauge
  if (ema200 == null || fg == null) return null;

  const pos = ctx.position;
  const st = ctx.state;
  if (!st.peak) st.peak = null;

  if (pos > 0) {
    const peak = st.peak != null ? Math.max(st.peak, px) : px;
    st.peak = peak;
    const trail = peak * 0.85; // give back up to 15% of the run before exiting
    const hardStop = ctx.entryPx != null ? ctx.entryPx * 0.80 : trail; // -20% disaster stop
    const stopPx = Math.max(trail, hardStop); // whichever is tighter protects the account
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'trail or -20% stop' }]);
    if (px <= stopPx) {
      st.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', note: 'F&G<20 & above 200d EMA', conds: [
    { label: 'Fear&Greed', now: fg, op: '<', ref: 20, closed: true },
    { label: 'Above 200d EMA', ok: px > ema200 }
  ]}]);
  if (fg < 20 && px > ema200) { // panic in a bull = dip to buy, not a trend change
    st.peak = px;
    const qty = (ctx.cash / px) * 0.99; // go nearly all-in on the dip
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
