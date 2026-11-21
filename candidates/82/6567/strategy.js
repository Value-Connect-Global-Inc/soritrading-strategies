/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Network Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active-address count is a daily on-chain measure of real network usage.
 * Sustained price up-trends tend to be accompanied by growing network activity; when usage contracts
 * while the price is still high, it often signals the move is running out of new participants. This
 * rides BTC's trend but only while on-chain usage is expanding — a fundamental confirmation that is
 * independent of the price chart alone.
 * When it buys and sells: Buy BTC with the whole account when the last closed daily close is above a
 * RISING 200-day SMA AND the 30-day average of active addresses is above its own longer average (network
 * expanding). Sell everything when the close falls below the SMA, or when network usage turns to
 * contraction even if the price is still up. A 3x ATR stop closes any position that drops too far from
 * entry.
 * When it does NOT work: The address data is daily and lags, so it cannot catch a fast crash that
 * happens before usage data updates. In a long sideways range the price crosses the SMA repeatedly and
 * each crossing costs fees. Long-only: it misses short-side profit in bear markets. On-chain data can
 * stay elevated for a while after a top, delaying the exit.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // On-chain network usage: 30-day average of active addresses vs its own longer average.
  // addr > addr_sma30 means short-term usage is above its 30-day mean = network expanding.
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const expanding = addr != null && addrSma != null && addr > addrSma;
  const usageKnown = addr != null && addrSma != null;

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility hard stop: 3x the 14-bar ATR from entry
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'usage contraction exit', conds: [{ label: 'network expanding', ok: expanding }] }
    ]);
    if (prevClose < sma * (1 - band) || (usageKnown && !expanding)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'network expanding', ok: expanding }] }]);
  if (rising && usageKnown && expanding && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
