/*
 * @coinsori-strategy v1
 * name: VWAP-Pullback Wide-Stop Trend SOL 4H
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Complements the contrarian champion (which buys panic
 * bottoms but lags strong melt-ups). This is a TREND-CONTINUATION dip buyer:
 * in an established uptrend it buys shallow pullbacks toward the 20-bar mean
 * (VWAP proxy) and rides the trend with a WIDE 10-ATR trailing stop so it
 * captures the melt-up moves the champion misses.
 * When it buys and sells: buys when price pulls back to within 1% of the
 * 20-bar rolling mean while price > 50-SMA > 200-SMA (confirmed uptrend);
 * sells when the 50-SMA turns down, or on a wide 10-ATR trailing stop from the
 * highest price since entry. 5-bar cooldown.
 * When it does NOT work: in a choppy/sideways regime the 50-SMA turn-down
 * fires often and whipsaws; in a sharp trend reversal the wide stop gives back
 * more than a tight stop would. Below the 200-SMA it sits out entirely.
 *
 * 2025-01-15: Added ctx.watch declarations — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;

  const sma20 = ctx.sma(20, 1);
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  if (sma20 == null || sma50 == null || sma200 == null) return null;

  const uptrend = price > sma50 && sma50 > sma200;

  if (pos > 0) {
    // Wide trailing stop: exit if price falls 10 ATR below the high since entry.
    const atr = ctx.atr(14, 1);
    const peak = ctx.state.peak || ctx.entryPx;
    ctx.state.peak = Math.max(peak, price);
    if (atr != null && price <= ctx.state.peak - atr * 10) {
      ctx.state.lastExit = ctx.i;
      ctx.watch([
        { side: 'sell', price: ctx.state.peak - atr * 10, trigger: 'below', note: 'trailing stop' }
      ]);
      return { side: 'sell', qty: pos };
    }
    // Exit when the 50-SMA stops rising (trend weakening).
    const sma50prev = ctx.sma(50, 6);
    if (sma50prev != null && sma50 <= sma50prev) {
      ctx.state.lastExit = ctx.i;
      ctx.watch([
        { side: 'sell', price: ctx.state.peak - atr * 10, trigger: 'below', note: 'trailing stop' }
      ]);
      return { side: 'sell', qty: pos };
    }
    // In position: watch trailing stop and trend exit
    ctx.watch([
      { side: 'sell', price: ctx.state.peak - atr * 10, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: sma50prev, trigger: 'below', note: '50-SMA turn-down', conds: [
        { label: '50-SMA falling', ok: sma50 <= sma50prev, closed: true }
      ]}
    ]);
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([]);
    return null;
  }
  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  // Buy a shallow pullback: price within 1% above the 20-bar mean (VWAP proxy).
  if (price <= sma20 * 1.01 && price >= sma20 * 0.97) {
    ctx.watch([
      { side: 'buy', price: sma20 * 1.01, trigger: 'below', note: 'pullback entry', conds: [
        { label: 'Uptrend', ok: uptrend, closed: true }
      ]}
    ]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  // Waiting for pullback to entry zone
  ctx.watch([
    { side: 'buy', price: sma20 * 1.01, trigger: 'below', note: 'pullback entry', conds: [
      { label: 'Uptrend', ok: uptrend, closed: true }
    ]}
  ]);
  return null;
}
