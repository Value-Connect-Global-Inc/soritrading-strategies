/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Hysteresis Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin spends long stretches trending above its 200-period (about 33-day) moving average on the 4h chart; riding those stretches captures most of a bull run, and stepping aside when the close falls back below it avoids the deepest drawdowns of crashes. A 2% hysteresis band around the average stops the strategy from whipsawing when price hovers right at the line, cutting fees and false exits. The edge over buy-and-hold is drawdown, not raw return.
 * When it buys and sells: Goes long when the 4h close rises 2% above the SMA(200) (confirms the trend has really turned). Exits to flat when the close falls 2% below the SMA(200), or immediately if price falls 15% below the entry (crash insurance only — the moving average is the real stop).
 * When it does NOT work: In a tight sideways market the price crosses the band repeatedly and the strategy still pays fees on whipsaws; it also re-enters late after a sharp V-shaped recovery, missing part of the bounce.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);         // 200-period SMA on the previous CLOSED bar (33-day regime)
  const prevClose = ctx.closes.at(-2); // previous closed bar close
  if (sma == null || prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.position;
  const hi = sma * 1.02;   // 2% band above — entry line
  const lo = sma * 0.98;   // 2% band below — exit line

  if (pos > 0) {
    let stop = null;
    if (ctx.entryPx != null) stop = ctx.entryPx * 0.85;  // 15% crash insurance, rarely hits
    const prevLow = ctx.lows.at(-2);
    ctx.watch([
      { side: 'sell', price: lo, trigger: 'below', note: 'close 2%<SMA200 regime exit' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: '15% hard stop' }] : [])
    ]);
    if (prevClose < lo || (stop != null && prevLow < stop)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat — enter only when the close is 2% above the regime SMA (confirmed turn)
  ctx.watch([{ side: 'buy', price: hi, trigger: 'above', note: 'close 2%>SMA200 regime entry' }]);
  if (prevClose > hi) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
