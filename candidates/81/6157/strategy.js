/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for months, but rallies backed by expanding on-chain usage
 * (daily active addresses) are more durable than speculative pumps. Gating the trend by network
 * usage keeps the strategy long through adoption-driven bull runs and steps out when usage dries
 * up, which typically happens before or during bear markets.
 * When it buys and sells: Longs when the 4h close is above its ~66-day average AND daily active
 * addresses are not clearly contracting (above 95% of their 30-day average). Sells when the close
 * falls under the average, active addresses contract deeply (below 85% of their 30-day average),
 * or price drops 18% from entry.
 * When it does NOT work: In a calm bull where usage plateaus while price grinds up, the usage gate
 * can keep it flat and it trails holding; in a pure speculative bubble with flat usage it misses
 * the top; and the slow exit still costs a drawdown in a fast crash.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 410) { ctx.watch([]); return null; }
  const price = ctx.price;
  const pos = ctx.position || 0;

  // account demoted/returning: no new entries, close any open position in an orderly way
  if (ctx.alloc != null && ctx.alloc.status != null && ctx.alloc.status !== 'ok') {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'Close: account not ok' }]);
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  const sma = ctx.sma(400, 1); // ~66 days on 4h: the medium trend separating up/down regimes
  if (sma == null) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2); // last CLOSED bar, identical in backtest/live
  if (closePrev == null) { ctx.watch([]); return null; }

  // On-chain usage regime (daily data): active addresses vs their 30-day average.
  // Hysteresis band: block entry on mild contraction (<95%), exit only on deep contraction (<85%).
  // null = data not available yet -> treat as neutral (never block on unknown).
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const haveUsage = addr != null && addrAvg != null && addrAvg > 0;
  const entryOk = haveUsage ? addr > addrAvg * 0.95 : null; // not meaningfully contracting -> may enter
  const usageExit = haveUsage && addr < addrAvg * 0.85;     // deeply contracting -> exit

  const trendUp = closePrev > sma;
  const entryPx = ctx.entryPx;
  const stopPx = entryPx != null ? entryPx * 0.82 : null; // hard -18% stop on every position
  const stopHit = stopPx != null && price < stopPx;

  if (pos <= 0) {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Long: close above ~66d avg' }]);
    if (trendUp && entryOk !== false) { // never buy into a clearly contracting network
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: sma, trigger: 'below', note: 'Exit: close under ~66d avg' },
    { side: 'sell', price: stopPx != null ? stopPx : price, trigger: 'below', note: 'Hard -18% stop',
      conds: [{ label: 'Active addr <85% of 30d avg', ok: usageExit }] }
  ]);
  if (!trendUp || stopHit || usageExit) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
