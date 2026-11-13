/*
 * @coinsori-strategy v1
 * name: SOL 4H Long/Short EMA50/200 Trend (usdm)
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On a perpetual we can hold both directions, so a slow trend filter can
 * ride SOL's melt-ups long AND make money shorting its crashes — a source of return that
 * buy-and-hold does not have (holding can only fall with the market).
 * When it buys and sells: Long a full position while EMA50>EMA200 and price is above the
 * 200-SMA; short a full position while EMA50<EMA200 and price is below the 200-SMA. Exit
 * when the trend condition flips, or when price moves 3x ATR(14) against the entry (hard stop).
 * When it does NOT work: In a long sideways/choppy market the filter whipsaws long and short
 * and pays fees + funding in both directions; in a violent V-shaped reversal the 4h close
 * confirms late and the hard stop may be the actual exit.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || sma200 == null || atr == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const longTrend = ema50 > ema200 && prevClose > sma200;
  const shortTrend = ema50 < ema200 && prevClose < sma200;

  if (ctx.position > 0) {
    // Hard stop: 3x ATR below entry — scales with volatility so it is neither too loose in
    // calm markets nor too tight in crashes.
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200 (exit long)', conds: [{ label: 'EMA50<EMA200', ok: ema50 < ema200 }] },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop 3xATR' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (!longTrend) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.position < 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx + 3 * atr : null;
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200 (exit short)', conds: [{ label: 'EMA50>EMA200', ok: ema50 > ema200 }] },
      ...(stop != null ? [{ side: 'buy', price: stop, trigger: 'above', note: 'hard stop 3xATR' }] : [])
    ]);
    if (stop != null && prevClose > stop) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
    if (!shortTrend) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
    return null;
  }

  // Flat: open the side matching the trend filter; no new entries while the allocator is reducing.
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (longTrend) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend confirmed', conds: [{ label: 'EMA50>EMA200', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  if (shortTrend) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'downtrend confirmed', conds: [{ label: 'EMA50<EMA200', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'sell', qty: qty };
  }

  ctx.watch([]);
  return null;
}
