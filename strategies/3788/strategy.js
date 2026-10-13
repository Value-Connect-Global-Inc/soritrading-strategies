/*
 * @coinsori-strategy v1
 * name: OnChain Network Health Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's long-term trend follows network fundamentals — miner commitment (hashrate) and user adoption (active addresses) — which move slower and are less noisy than price itself.
 * When it buys and sells: Buys when BOTH hashrate and active addresses are above their 30-day averages (network expanding). Sells when EITHER drops below its average (network contracting).
 * When it does NOT work: In flat sideways regimes where network metrics hover around their averages it can whipsaw. It reacts slowly to sharp price crashes because on-chain data lags price — so a hard price stop is NOT included in this first version and drawdown can be large in sudden bears.
 */
function onUpdate(ctx) {
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (hr == null || hrSma == null || addr == null || addrSma == null) return null;

  // Network is expanding only when BOTH fundamentals are above their own 30d average.
  // AND on entry avoids buying on a one-sided spike; OR on exit gets us out fast if either weakens.
  const growing = hr > hrSma && addr > addrSma;

  if (ctx.position <= 0 && growing) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position > 0 && !growing) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
