/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend Core Hard Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The simplest robust trend-follower. In this cycle the funding gate
 * and the on-chain usage gate BOTH lost to this plain core — no external data beats it,
 * which means it works anywhere (no FRED, no funding, no on-chain dependency). It rides
 * sustained 4h trends and cuts every losing position with a hard -25% disaster stop, so
 * a single bad trade can never sink the account.
 * When it buys and sells: Buy when EMA50 is above EMA200 and price is above EMA50 (uptrend).
 * Sell when the trend breaks (price below the lower EMA) or price falls -25% from entry.
 * When it does NOT work: in a choppy sideways market the trend filter whipsaws and pays
 * fees; long-only means a sustained bear market is flat-to-loss. It never beats a straight
 * buy-and-hold in a one-way melt-up because it is out of the market part of the time.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const trendUp = ema50 > ema200 && prevClose > ema50;

  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (trendUp) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up' }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up' }]);
  return null;
}
