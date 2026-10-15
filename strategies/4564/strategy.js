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
 * is rising above its own recent average, adoption is growing and price tends
 * to follow; when usage contracts, price tends to correct. This is a
 * fundamentally different signal axis from price momentum, and the long-term
 * trend gate keeps it from buying into confirmed bear markets.
 * When it buys and sells: buys when active addresses are >3% above their
 * 30-day average AND price is above its 200-day SMA; exits when addresses fall
 * <3% below their average, or price drops 15% below entry (hard stop).
 * When it does NOT work: on-chain signals lag fast crashes and are noisy in
 * the chop after a hype cycle; the 200-day gate keeps it mostly in cash during
 * bears, so it under-captures sharp V-recoveries out of the bottom.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Network usage regime from the connected on-chain dataset (daily addresses).
  const addr = ctx.data('addr');
  const sma = ctx.data('addr_sma30');
  if (addr == null || sma == null || sma <= 0) return null;
  const ratio = addr / sma;
  // Hysteresis: 3% band around the average stops the constant churn seen in v1.
  const enterBand = 1.03, exitBand = 0.97;

  // Long-term trend gate: never buy into a confirmed downtrend (price below 200d SMA).
  const trend = ctx.sma(200, 1);
  if (trend == null) return null;
  const uptrend = price > trend;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 15% hard stop: caps any single position's loss.
      const stopPx = entry * 0.85;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: -15%' }]);
    }
    if (ratio < exitBand) return { side: 'sell', qty: pos }; // usage clearly contracting
    return null;
  }

  if (ratio > enterBand && uptrend) {
    const qty = (ctx.cash * 0.95) / price;
    ctx.watch([{ side: 'buy', note: 'addr > 3% avg & trend up' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', note: 'wait: addr > 3% avg & trend up' }]);
  return null;
}
