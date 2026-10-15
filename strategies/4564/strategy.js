/*
 * @coinsori-strategy v1
 * name: OnChain Activity Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price historically follows real network usage.
 * Daily active addresses measure people actually using the network. When usage
 * is rising above its own 30-day average, adoption is growing and price tends
 * to follow; when usage contracts, price tends to correct. This is a
 * fundamentally different signal axis from price momentum.
 * When it buys and sells: buys when active addresses are above their 30-day
 * average (network growing); sells when they fall back below it (usage
 * shrinking), or when price drops 15% below entry (hard stop).
 * When it does NOT work: in the sideways phase after a hype cycle the address
 * count can stay high while price chops, causing whipsaws; in a deep bear the
 * address signal lags the crash, so the hard stop does the real work.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Network usage regime from the connected on-chain dataset (daily addresses).
  const addr = ctx.data('addr');
  const sma = ctx.data('addr_sma30');
  if (addr == null || sma == null || sma <= 0) return null;
  const growing = addr > sma; // usage above its own 30-day average = adoption growing

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 15% hard stop: round, defensible cap on any single position's loss.
      const stopPx = entry * 0.85;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: -15%' }]);
    }
    if (!growing) return { side: 'sell', qty: pos }; // usage contracting -> exit
    return null;
  }

  if (growing) {
    const qty = (ctx.cash * 0.95) / price;
    ctx.watch([{ side: 'buy', note: 'network usage growing' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', note: 'wait: addr > 30d avg' }]);
  return null;
}
