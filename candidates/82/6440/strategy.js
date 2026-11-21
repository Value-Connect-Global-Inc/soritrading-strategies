/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime SMA200 Slope 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC alternates between long trending regimes; the 200-bar SMA separates
 * them. We stay long only while price is clearly above it, so we ride up-trends
 * and step aside entirely in down-trends. Requiring the SMA200 itself to be
 * rising filters out sideways chop where price pokes above the average but the
 * trend never really starts. A wide 5xATR trailing stop only fires on major
 * reversals, protecting profit without whipsawing out of trends.
 * When it buys: the last closed bar closes more than 2% above the 200-bar SMA
 * AND the SMA200 is higher than it was 20 bars ago (trend confirmed rising).
 * When it sells: the last closed bar closes below the SMA200 minus 2%, or, once
 * the trade is up more than 8%, price closes 5xATR below the highest close
 * since entry.
 * When it does NOT work: long sideways chop where the SMA200 stays flat, and it
 * lags the exact top/bottom of every swing.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21); // 20 bars earlier, for the slope
  if (sma200 == null || sma200Prev == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const buyBand = sma200 * 1.02;   // enter only when clearly above the trend average
  const sellBand = sma200 * 0.98;  // base exit: clearly below the trend average

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const entry = ctx.entryPx;
    let peak = ctx.state.peak || 0;
    if (prevClose > peak) peak = prevClose;
    ctx.state.peak = peak;

    let trail = null;
    // arm only after a clear profit so fresh-entry pullbacks never stop us out;
    // 5xATR is wide enough to survive normal bull-run pullbacks (judgement)
    if (atr != null && entry != null && peak > entry * 1.08) {
      trail = peak - 5 * atr;   // 5 ATR below the highest close since entry
    }
    const stop = (trail != null && trail > sellBand) ? trail : sellBand;

    ctx.watch([
      { side: 'sell', price: sellBand, trigger: 'below', note: 'trend breakdown' },
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' }
    ]);
    if (prevClose < sellBand || (trail != null && prevClose < trail)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.peak = 0;
  const trendUp = sma200 > sma200Prev; // only buy when the trend average is rising
  ctx.watch([{ side: 'buy', price: buyBand, trigger: 'above', note: 'uptrend confirmed' }]);
  if (prevClose > buyBand && trendUp) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
