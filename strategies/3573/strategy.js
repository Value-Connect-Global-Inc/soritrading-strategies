/*
 * @coinsori-strategy v1
 * name: BTC Active-Address Capitulation Reversal 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain active addresses track real user activity.
 * When they crash to extreme lows relative to their 30-day average, selling
 * pressure is exhausted — holders have given up — which historically marks a
 * zone where price stabilises and recovers. We buy that exhaustion and sell
 * once usage has recovered to its average (the recovery leg), a contrarian
 * mean-reversion bet on adoption, not on price bounces.
 * When it buys and sells: buy when active addresses fall to <= 90% of their
 * 30-day average AND price is above its 50-day EMA (recovering). Sell when
 * addresses return to their 30-day average, or price closes below the 50-day
 * EMA, or a 2.5x ATR stop from entry is hit.
 * When it does NOT work: a genuine structural decline (addresses keep falling
 * for months) has no bottom to catch — the strategy keeps buying early into a
 * real bear. It also stays out during long bull runs (addresses never crash),
 * so it misses melt-ups entirely. Shallow dips do not trigger it.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || ema50 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2.5 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    // usage recovered to its 30d average → take the recovery profit
    if (addr >= addrSma) return { side: 'sell', qty: pos };
    if (price < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: 'recovery failed' },
               { side: 'sell', note: 'usage back to avg', conds: [{ label: 'addr vs sma30', now: addr, op: '>=', ref: addrSma, closed: true }] }]);
    return null;
  }

  // exhaustion: addresses at or below 90% of their 30d average
  if (addr > addrSma * 0.90) return null;
  // price must be recovering (above 50d EMA), not still collapsing
  if (price <= ema50) return null;

  const riskCash = ctx.cash * 0.01;        // 1% equity risked per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
