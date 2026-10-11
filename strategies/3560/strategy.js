/*
 * @coinsori-strategy v1
 * name: BNB Trend-Follow EMA50/200 4H re-entry trailing
 * ex: binance
 * syms: BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Re-entry while flat when the trend is intact (EMA50>EMA200,
 *   price>SMA400) improved the BTC variant. An 8% fixed trailing stop held up on
 *   the BTC 4h trend family, so this tests it on BNB instead of the fixed ATR stop.
 * When it buys and sells: buys on a bullish EMA50/200 crossover above SMA200, and
 *   re-buys while flat if EMA50>EMA200 and price>SMA400. Sells on death cross or
 *   when price falls 8% below the highest close since entry (trailing stop).
 * When it does NOT work: choppy sideways ranges whipsaw the crossover; long-only
 *   means a sustained bear market is flat-to-loss.
 */
function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || sma400 == null || atr == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    // ratchet the trailing reference up to the highest close since entry
    let hi = ctx.state.hiSinceEntry;
    if (hi == null || prevClose > hi) hi = prevClose;
    ctx.state.hiSinceEntry = hi;
    const stopPx = hi * 0.92; // 8% trailing stop from highest close
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    if (fp > sp && f <= s) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'trailing stop' }]);
    return null;
  }

  let enter = false;
  if (fp <= sp && f > s && prevClose > sma200) enter = true;
  else if (f > s && prevClose > sma400) enter = true;
  if (!enter) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  ctx.state.hiSinceEntry = null; // reset on new entry
  return { side: 'buy', qty };
}
