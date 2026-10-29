/*
 * @coinsori-strategy v1
 * name: BTC Pure SMA200 Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Every risk-managed strategy in this job failed to beat
 * buy-and-hold because it was under-invested during crypto's explosive bull
 * phases. The 200-day moving average is the classic regime filter: fully
 * invested while price holds above it, fully in cash while below. It rides
 * the entire bull (no early exits) and steps aside for the bear.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average (and holds as long as it stays above). Sells when the close falls
 * below the 200-day average. No other exits — that is the whole rule.
 * When it does NOT work: In a long sideways range it whipsaws across the
 * 200-day line, paying fees on both sides. It lags sharp V-shaped recoveries
 * (waits for the close to reclaim the average). It is 100% invested in a bull,
 * so a sudden crash below the average gives back the full drawdown before the
 * exit triggers.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (prevClose > sma200) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
