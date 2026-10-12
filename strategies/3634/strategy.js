/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: When bitcoin gets oversold on the 4h chart (price below
 *   the lower Bollinger Band and RSI below 30), it often snaps back to its
 *   moving average before the next leg. We buy the snap-back, not the trend.
 * When it buys and sells: buy a close below the lower Bollinger Band with
 *   RSI(14) < 30; sell back at the middle band, on RSI(14) > 60, or on a 2x
 *   ATR hard stop.
 * When it does NOT work: in a strong downtrend oversold stays oversold and
 *   every "cheap" buy keeps losing until the stop. Mean reversion is a
 *   sideways-market edge; it bleeds in trending markets.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);            // closed-bar Bollinger bands
  const rsi = ctx.rsi(14, 1);             // closed-bar RSI
  const atr = ctx.atr(14, 1);
  if (bb == null || bb.lower == null || rsi == null || atr == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2 * atr;   // 2x ATR room below entry
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    // Mean reversion complete: price back at the middle band or RSI overbought
    if (prevClose >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR hard stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'mean reversion target' },
               { side: 'sell', price: null, note: 'wait for RSI > 60' }]);
    return null;
  }

  if (prevClose >= bb.lower) return null;  // not oversold enough
  if (rsi >= 30) return null;              // need real oversold + confirmation

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
