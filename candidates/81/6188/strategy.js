/*
 * @coinsori-strategy v1
 * name: SOL 4H EMA50/200 Trend + SMA200 Crash Filter
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A slow trend filter on a high-beta asset rides crypto's strongest rallies
 * and steps aside in the crashes. The EMA50>EMA200 + close-above-SMA200 condition is the
 * confirmed-uptrend gate; the SMA200 gate is the crash filter. It reliably beats buy-and-hold
 * in bear markets (2022 and 2025-26) and still compounds strongly in bull runs, though it
 * cannot match a straight-line melt-up.
 * When it buys and sells: Hold a full position while the 50-EMA is above the 200-EMA and price
 * is above the 200-SMA (confirmed uptrend). Sell everything when either breaks. A wide -35%
 * disaster stop is tail insurance only.
 * When it does NOT work: In a long sideways/choppy period the filter whipsaws and pays fees; in
 * a violent V-shaped crash the 4h close confirms late, so the disaster stop may be the actual
 * exit. It lags a straight-line melt-up that never pulls back to its averages, and its bull
 * drawdown is still large because a fast crash can gap through every close-based stop.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || sma200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = ema50 > ema200 && prevClose > sma200;

  if (ctx.position > 0) {
    // Disaster stop: -35% from entry, tail insurance only (SOL can gap through the filter in a crash).
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.65 : null;
    const exitBelow = Math.min(ema50, sma200);
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken (EMA50 or SMA200)' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -35%' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Flat: no new entries while the allocator is in reduce-only mode.
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (uptrend) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend confirmed', conds: [{ label: 'EMA50>EMA200', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'waiting for uptrend', conds: [{ label: 'EMA50>EMA200', ok: ema50 > ema200 }] }]);
  return null;
}
