/*
 * @coinsori-strategy v1
 * name: OnChain Adoption Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active-address count (blockchain.com) is a
 * real network-usage signal that is independent of price. When active addresses
 * run above their own 30-day average, usage is growing — an adoption/accumulation
 * regime. This uses that data axis directly instead of only price crossovers.
 * When it buys and sells: buy when active addresses are at least 3% above their
 * 30-day average AND price is above the 200-day SMA (stays out of deep bears).
 * Sell when addresses fall back below their 30-day average, when price breaks
 * below the 200-day SMA, or when price falls 3 ATR below the entry.
 * When it does NOT work: in a long flat range where addresses oscillate around
 * their average it whipsaws and the stops turn small dips into realized losses.
 * It lags fast price moves because the address data updates only daily, and a
 * sustained bear market keeps it flat (long-only).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain usage: daily active addresses vs its own 30-day average.
  // null = data not available for this bar -> do nothing (never treat as 0).
  const addr = ctx.data('addr');
  const a30 = ctx.data('addr_sma30');
  if (addr == null || a30 == null || a30 <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    // 3 ATR stop: with a daily signal, a tighter stop gets hit by normal daily
    // noise inside an intact adoption trend (same lesson as the 4-asset basket).
    const stopPx = entry != null ? entry - 3 * atr : price - 3 * atr;
    // Exit: adoption rolls over, or the long-term price regime breaks.
    // The 3% entry band vs plain rollover exit gives hysteresis so a one-day
    // wobble in addresses does not churn the position.
    if (addr < a30 || price <= stopPx || price < sma200) {
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 3 ATR' }]);
    return null;
  }

  // Entry: meaningful adoption growth (3% above its own average) AND price above
  // the 200d SMA. The SMA filter keeps us out of bear regimes where adoption
  // growth is a dead-cat bounce (sentiment-family lesson: no regime filter -> knives).
  if (addr <= a30 * 1.03) return null;
  if (price <= sma200) return null;

  // Size: risk 2% of cash on the stop distance so a wide daily stop cannot ruin
  // the account; single-asset so 2% is the whole risk budget.
  const riskCash = ctx.cash * 0.02;
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
