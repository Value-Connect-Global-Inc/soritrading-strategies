/*
 * @coinsori-strategy v1
 * name: OnChain Adoption Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto bull markets are driven by new users and new
 * mining capacity — both visible on-chain before they fully show up in price.
 * When the number of daily active addresses is above its own 30-day average
 * AND network hash rate is above its 30-day average, the network is growing
 * and price tends to follow. This is a slow regime bet on adoption, a
 * different family from price trend or sentiment indexes.
 * When it buys and sells: buy when active addresses > their 30-day average
 * AND hash rate > its 30-day average (both from closed daily bars). Hold
 * while network growth persists. Sell when active addresses fall back below
 * their 30-day average, or if price drops 25% below entry (hard stop).
 * When it does NOT work: in a mature market where price moves on macro
 * liquidity (interest rates, dollar) while on-chain usage stays flat, this
 * stays on the sidelines and misses rallies. Active addresses can also stay
 * elevated for a while after a crash, so the exit lags price.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const hash = ctx.data('hashrate');
  const hashSma = ctx.data('hashrate_sma30');
  // Data is daily; if any value is missing for this bar, do nothing rather
  // than guess (null means unknown, never zero).
  if (addr == null || addrSma == null || hash == null || hashSma == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // Hard stop: 25% because a regime exit is slow (daily data) and cannot
      // protect against a fast crash on its own.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Regime exit: network usage stopped growing, adoption trend is over.
    if (addr < addrSma) return { side: 'sell', qty: pos };
    return null;
  }

  // Regime entry: both adoption and miner confidence growing at once.
  if (addr > addrSma && hash > hashSma) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
