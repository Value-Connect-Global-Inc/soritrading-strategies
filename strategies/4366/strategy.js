/*
 * @coinsori-strategy v1
 * name: BTC Hashrate Cycle 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network hashrate (miners' computing power) is a
 *   slow fundamental that tracks the crypto cycle — it rises while mining is
 *   profitable (bull) and stalls at bottoms. This bets the fundamental trend
 *   of network investment times the price trend.
 * When it buys and sells: hold BTC while daily hashrate is above its own
 *   30-day average; sell when hashrate drops back below that average.
 * When it does NOT work: hashrate is slow and almost always growing, so in a
 *   bear it stays long too long and gives back gains; it lags a sharp crash
 *   because the network keeps hashing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (hr == null || hrAvg == null || hrAvg <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    if (hr < hrAvg) return { side: 'sell', qty: pos };
    return null;
  }
  if (hr <= hrAvg) return null;
  const qty = (ctx.cash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
