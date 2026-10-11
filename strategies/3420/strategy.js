/*
 * @coinsori-strategy v1
 * name: Spread Squeeze Imbalance
 * ex: binance
 * syms: BTCUSDT
 * interval: 5m
 * cash: 1000
 *
 * Why this strategy: A compressed bid/ask spread (spread squeeze) often precedes a
 * burst of volatility; combining it with a lopsided order book tells us which way
 * the burst is likely to go.
 * When it buys and sells: It buys when the spread is unusually tight AND the book
 * has clearly more buy-side depth AND the trend is up; it sells when the spread
 * widens back out, the book flips against us, or a hard stop / target is hit.
 * When it does NOT work: In quiet low-liquidity regimes the squeeze fires with no
 * follow-through and the book signal is noise; a single large market order can also
 * move price faster than any book snapshot can react to.
 */
function onUpdate(ctx) {
  const spread = ctx.spreadPct();
  const bid = ctx.bid();
  const ask = ctx.ask();
  if (spread == null || bid == null || ask == null) return null;
  const mid = ctx.mid();
  const price = ctx.price;
  if (mid == null || mid <= 0) return null;

  // spread is a live tick value (not a bar series), so keep our own rolling history
  const st = ctx.state || {};
  const hist = st.spreadHist || [];
  hist.push(spread);
  if (hist.length > 100) hist.shift();
  st.spreadHist = hist;
  ctx.state = st;
  if (hist.length < 30) return null;

  let avg = 0;
  for (let i = Math.max(0, hist.length - 50); i < hist.length; i++) avg += hist[i];
  avg /= Math.min(50, hist.length);
  if (avg <= 0) return null;

  const compression = spread < avg * 0.75; // squeeze = spread at 75% of its recent average

  // book imbalance within 0.1% of mid (optional: some venues return null in backtest)
  let imb = 0;
  const pxRange = mid * 0.001;
  const bidDepth = ctx.depth('bid', mid - pxRange);
  const askDepth = ctx.depth('ask', mid + pxRange);
  if (bidDepth != null && askDepth != null) {
    const total = bidDepth + askDepth;
    if (total > 0) imb = (bidDepth - askDepth) / total;
  }

  // trend context from CLOSED bars only
  const ef = ctx.ema(20, 1);
  const es = ctx.ema(50, 1);
  if (ef == null || es == null) return null;

  // exits first
  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: ctx.entryPx * 1.04, trigger: 'above', note: 'target' },
      { side: 'sell', price: ctx.entryPx * 0.98, trigger: 'below', note: 'hard stop' }
    ]);
    if (spread > avg * 1.2 || imb < -0.1 || price < ctx.entryPx * 0.98 || price > ctx.entryPx * 1.04) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // entry: squeeze + heavy bid depth + uptrend (depth optional when venue hides it)
  if (compression && imb > 0.15 && ef > es) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
