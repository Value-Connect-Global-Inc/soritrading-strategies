/*
 * @coinsori-strategy v1
 * name: SOL 4H Trend with Chandelier Trail
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A slow EMA50/200 + SMA200 trend filter captures most of a bull run but
 * rides the big within-trend pullbacks all the way down (its drawdown matches buy-and-hold).
 * Replacing the slow exit with a chandelier trailing stop (3x ATR below the 20-bar high) exits
 * those pullbacks early, cutting drawdown while keeping the same trend-following entry.
 * When it buys and sells: Buy when EMA50>EMA200, price is above the 200-SMA and above the
 * chandelier level (not in a deep dip). Sell when price closes below the chandelier, below the
 * 200-SMA, 3x ATR below entry (hard stop), or the uptrend gate breaks.
 * When it does NOT work: In a long sideways/choppy market the chandelier whipsaws and pays fees;
 * in a violent fast crash the 4h close confirms late so the trailing stop is hit after a big
 * drop. It still lags a straight-line melt-up that never pulls back.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const hh = ctx.high(20, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || sma200 == null || atr == null || hh == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = ema50 > ema200;
  const chandelier = hh - 3 * atr;

  if (ctx.position > 0) {
    // Hard stop: 3x ATR below entry (tail insurance).
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    // Chandelier trail only once it is above the entry (otherwise it exits the position immediately).
    const trail = (ctx.entryPx != null && chandelier > ctx.entryPx) ? chandelier : null;
    ctx.watch([
      ...(trail != null ? [{ side: 'sell', price: trail, trigger: 'below', note: 'chandelier trail 3xATR' }] : []),
      { side: 'sell', price: sma200, trigger: 'below', note: 'crash gate SMA200' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop 3xATR' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (!uptrend || prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (trail != null && prevClose < trail) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Flat: no new entries while the allocator is in reduce-only mode.
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  // Entry: confirmed uptrend, above the long-term floor, and NOT in a deep dip below the chandelier.
  if (uptrend && prevClose > sma200 && prevClose > chandelier) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend confirmed', conds: [{ label: 'EMA50>EMA200', ok: true }, { label: 'close>chandelier', ok: prevClose > chandelier }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'waiting for uptrend', conds: [{ label: 'EMA50>EMA200', ok: uptrend }] }]);
  return null;
}
