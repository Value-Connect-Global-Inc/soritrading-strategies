/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Adoption Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A completely different family from the price-based RSI2 mean-reversion
 * champion. It bets on the on-chain adoption cycle: when the number of active Bitcoin
 * addresses is expanding above its 30-day average, real network usage is growing and a
 * bull phase is usually underway. When usage contracts, the market is usually rolling over.
 * When it buys and sells: Buys when active addresses are at least 2% above their 30-day
 * average. Sells when active addresses fall 2% below their 30-day average. Otherwise it
 * just holds whatever it has. The 2% buffer (hysteresis) stops the strategy from churning
 * on small daily noise in the address count.
 * When it does NOT work: On-chain usage is a slow, lagging signal — it turns late at tops
 * and bottoms, so it gives back some of every swing. In a long sideways chop it whipsaws.
 * It is a long/flat regime filter, not a timing tool.
 */

function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const addr30 = ctx.data('addr_sma30');
  if (addr == null || addr30 == null) return null;

  if (ctx.position <= 0) {
    // Only enter on a genuine adoption expansion, not tiny daily noise.
    if (addr > addr30 * 1.02) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
    }
    return null;
  }

  // Exit only when adoption clearly contracts — hysteresis avoids whipsaw.
  if (addr < addr30 * 0.98) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
