/*
 * @coinsori-strategy v1
 * name: SOL 4H Trend with Vol-Targeted Sizing
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The plain EMA50/200 + SMA200 trend filter already beat buy-and-hold in
 * the 2022 bear (made money while holding lost 51%), but its drawdown was still ~80% because
 * it was fully invested when volatility exploded. Sizing the position DOWN when volatility is
 * high keeps the upside of a calm trend while cutting the damage of a crash.
 * When it buys and sells: Hold a position while EMA50>EMA200 and price is above the 200-SMA
 * (confirmed uptrend). Position size is rebalanced EVERY bar toward a volatility target: when
 * ATR(14) is high we trim, when it is calm we add back. Sell everything when the trend breaks
 * or price falls 3x ATR below entry (hard stop).
 * When it does NOT work: In a long sideways/choppy market the filter whipsaws and pays fees;
 * in a violent V-shaped crash the 4h close confirms late and the hard stop may be the actual
 * exit. It still cannot keep up with a straight-line melt-up that never pulls back.
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

  const uptrend = ema50 > ema200 && prevClose > sma200;
  // Volatility target: ~4% ATR per 4h bar is the "normal" level we size to; above it we hold less.
  const targetVol = 0.04;
  const atrPct = atr / prevClose;
  const scale = Math.min(1, targetVol / atrPct);

  if (ctx.position > 0) {
    // Hard stop: 3x ATR below entry — scales with volatility (tail insurance, trend exit is primary).
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    const exitBelow = Math.min(ema50, sma200);
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken (EMA50 or SMA200)' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop 3xATR' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    // Vol-target rebalance on TOTAL equity (cash + position value), 3% deadband to avoid churn.
    const equity = ctx.cash + ctx.position * prevClose;
    const targetQty = (equity / prevClose) * 0.99 * scale;
    if (ctx.position > targetQty * 1.03) return { side: 'sell', qty: ctx.position - targetQty, reduceOnly: true };
    if (ctx.position < targetQty * 0.97) return { side: 'buy', qty: targetQty - ctx.position };
    return null;
  }

  // Flat: no new entries while the allocator is in reduce-only mode.
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (uptrend) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend confirmed', conds: [{ label: 'EMA50>EMA200', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99 * scale;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'waiting for uptrend', conds: [{ label: 'EMA50>EMA200', ok: ema50 > ema200 }] }]);
  return null;
}
