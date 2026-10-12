/*
 * @coinsori-strategy v1
 * name: OnchainDemandTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active addresses are a measure of real network
 * usage. When usage expands (active addresses above their 30-day average) inside
 * an established uptrend (price above its 200-day average), demand tends to lead
 * price higher. This is an on-chain fundamental signal, not a price pattern, so
 * it is a different edge than the price-based champion.
 * When it buys and sells: buy when active addresses are clearly above their
 * 30-day average (addr > 1.05 x avg) AND the close is above the 200-day average
 * AND RSI(14) is below 75 (not buying the very top of a melt-up). Sell when
 * active addresses clearly fall below their 30-day average (addr < 0.95 x avg),
 * or the close drops below the 200-day average, or price hits a 2x ATR stop.
 * The 5% band is hysteresis: daily address data is noisy, so requiring a clear
 * expansion/contraction avoids churning on every wiggle.
 * When it does NOT work: in a bear market price stays below the 200-day average
 * and the strategy never trades (safe but no profit). Address data lags price by
 * days, so it can confirm a move only after it started; in a slow grind with no
 * clear usage expansion it sits in cash through a real rally.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  // On-chain values arrive as strings in this account's data — coerce with Number().
  const addr = Number(ctx.data('addr'));
  const addrSma = Number(ctx.data('addr_sma30'));
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (!Number.isFinite(addr) || !Number.isFinite(addrSma) || addr <= 0 || addrSma <= 0 ||
      sma200 == null || atr == null || atr <= 0 || rsi == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.position;
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr; // 2x ATR stop: cap a single bad trade
    // Clear demand contraction, trend break, or hard stop ends the position.
    if (price <= hardStop || addr < 0.95 * addrSma || prevClose < sma200) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  // Entry: clear usage expansion (addr > 105% of 30d avg) in an uptrend, not
  // over-extended. RSI<75 mirrors the validated champion gate that avoids
  // buying parabolic tops. 1.05 hysteresis: ignore small daily noise.
  if (addr > 1.05 * addrSma && prevClose > sma200 && rsi < 75) {
    ctx.watch([]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', note: 'on-chain demand expansion in uptrend',
               conds: [{ label: 'addr vs 30d avg', now: addr / addrSma, op: '>', ref: 1.05, closed: true },
                       { label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'RSI(14) close', now: rsi, op: '<', ref: 75, closed: true }] }]);
  return null;
}
