/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Activity Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily active addresses) tends to lead
 * price over weeks — when usage expands well above its own 30-day average a real
 * uptrend is usually underway; when it contracts the trend is fading.
 * When it buys and sells: Long BTC when active addresses are >15% above their 30-day
 * average; exit when they fall >15% below the average. A 20% hard stop-loss caps
 * every position.
 * When it does NOT work: In sideways chop where usage is flat but price drifts, it
 * whipsaws; and in late-stage blowoffs where price runs on speculation while usage
 * lags, it stays out and misses the top.
 */

function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const sma = ctx.data('addr_sma30');
  if (addr == null || sma == null || sma <= 0) return null;
  const ratio = addr / sma;
  const pos = ctx.position || 0;

  if (pos === 0) {
    // Entry: usage clearly expanding >15% above its 30-day avg (wide band = ignore daily noise)
    if (ratio > 1.15) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', note: 'enter when usage >15% above 30d avg', conds: [{ label: 'addr/avg30', now: ratio, op: '>', ref: 1.15, closed: true }] }]);
    return null;
  }

  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : null; // 20% hard stop: cap single-position loss
  const exitByUsage = ratio < 0.85; // exit only on clear contraction, not small dips
  ctx.watch([
    { side: 'sell', note: 'exit when usage <15% below 30d avg', conds: [{ label: 'addr/avg30', now: ratio, op: '<', ref: 0.85, closed: true }] },
    ...(stop ? [{ side: 'sell', price: stop, trigger: 'below', note: '20% hard stop' }] : [])
  ]);
  if (exitByUsage) return { side: 'sell', qty: pos };
  if (stop && ctx.price <= stop) return { side: 'sell', qty: pos };
  return null;
}
