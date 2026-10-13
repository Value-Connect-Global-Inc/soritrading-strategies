/*
 * @coinsori-strategy v1
 * name: BtcHashrateCapitulation
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network hash rate is a slow, hard-to-fake fundamental.
 * When miners capitulate (hash rate drops below its own 30-day average) it often marks a
 * local bottom; the recovery of hash rate shows the network is healthy again.
 * When it buys and sells: Buys when hash rate recovers back above its 30-day average
 * within 60 days of a capitulation dip, while price is above its 200-day average (healthy
 * long-term trend). Sells on a 2.5x ATR trailing stop, or immediately if hash rate starts
 * capitulating again while we hold.
 * When it does NOT work: hash rate keeps rising for years even in bear markets, so the
 * signal is noisy; in a long bear market the 200-day filter keeps it in cash and it misses
 * the decline. Long only, so no profit from falling markets.
 */

function onUpdate(ctx) {
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const sma200 = ctx.sma(200, 1);
  if (hr == null || hrSma == null || sma200 == null) return null;

  const ratio = hr / hrSma;
  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  // remember the most recent bar where miners were capitulating (hash below its 30d avg)
  if (ratio < 0.97) st.lastDip = ctx.i;

  if (pos === 0) {
    // entry: hash recovered above its 30d avg within 60 days of a dip, long-term trend healthy
    const recentDip = st.lastDip != null && (ctx.i - st.lastDip) <= 60;
    if (recentDip && ratio > 0.99 && price > sma200) {
      const atr = ctx.atr(14, 1);
      if (atr == null) return null;
      st.hi = price;
      // risk 3% of the account on a 2.5x ATR stop
      const qty = (ctx.cash * 0.03) / (2.5 * atr);
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  // exit 1: miners capitulating again while we hold
  if (ratio < 0.97) return { side: 'sell', qty: pos };

  // exit 2: trailing stop on the highest close since entry
  if (price > st.hi) st.hi = price;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopPx = st.hi - 2.5 * atr;
  ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '2.5x ATR trailing stop' }]);
  if (price <= stopPx) return { side: 'sell', qty: pos };
  return null;
}
