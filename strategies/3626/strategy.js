/*
 * @coinsori-strategy v1
 * name: ETH Fear-Greed Mean Reversion 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: extreme fear readings of the crypto fear-greed index
 *   historically mark local bottoms — the crowd is most bearish exactly when
 *   price is stretched below its mean, and that stretch tends to snap back.
 *   This is a contrarian bet, the opposite of a trend-following breakout.
 * When it buys and sells: buy only when the fear-greed index is below 25
 *   (extreme fear) AND RSI(14) is oversold AND the close is below the lower
 *   Bollinger band. Sell when price reverts to the middle band, RSI climbs
 *   back above 50, a 2.5x ATR hard stop is hit, or after 90 bars (~15 days).
 * When it does NOT work: prolonged bear markets keep stretching price further
 *   down after the first oversold bounce, so early entries hit the stop and
 *   re-entry keeps catching the knife. Low-volatility chop gives few signals.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');          // fear-greed index, 0..100 (daily series)
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || rsi == null || bb == null || atr == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (price >= bb.middle) return { side: 'sell', qty: ctx.position };  // reversion to mean done
    if (rsi > 50) return { side: 'sell', qty: ctx.position };            // momentum turned back up
    if (ctx.i - (ctx.state.entryBar || ctx.i) > 90) return { side: 'sell', qty: ctx.position };  // time stop
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: bb.middle, trigger: 'above', note: 'revert to mean' },
               { side: 'sell', price: bb.middle, trigger: 'above', note: 'RSI>50 exit' }]);
    return null;
  }

  if (fg > 25) return null;            // only buy in extreme fear
  if (rsi >= 30) return null;          // must be oversold
  if (prevClose >= bb.lower) return null;  // price must be stretched below the band

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  ctx.state.entryBar = ctx.i;
  return { side: 'buy', qty };
}
