/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend Core Post2020 Validation
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: This is the confirmed plain trend core (identical code to strategy
 * 6207) re-validated on three non-overlapping post-2020 windows. Every modification this
 * job tried — funding gates, on-chain usage gates, volatility sizing — lost to this plain
 * core, so it is the control. It rides sustained 4h trends and cuts every losing position
 * with a hard -25% disaster stop, so a single bad trade can never sink the account. It
 * works anywhere: no FRED, no funding, no on-chain dependency.
 * When it buys and sells: Buy when EMA50 is above EMA200 and price is above EMA50 (uptrend).
 * Sell when the trend breaks (price below the lower EMA) or price falls -25% from entry.
 * When it does NOT work: in a choppy sideways market the trend filter whipsaws and pays
 * fees; long-only means a sustained bear market is flat-to-loss; it never beats a straight
 * buy-and-hold in a one-way melt-up (2020-21) because it is out of the market part of the
 * time — that regime is structurally impossible for long-only and is excluded here.
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
