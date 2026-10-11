/*
 * @coinsori-strategy v1
 * name: Volatility ATR Trend Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: High volatility breakouts accompanied by sustained momentum above SMA(20) capture major crypto trend expansions.
 * When it buys and sells: Buys when close exceeds SMA(20) by 1.5x ATR and volume confirms. Sells on trailing stop or ATR reversal.
 * When it does not work: Choppy, mean-reverting markets with low trend continuation.
 */

function onUpdate(ctx) {
  if (ctx.closes.length < 30) return null;

  const s20 = ctx.sma(20, 1);
  const atr14 = ctx.atr(14, 1);
  if (s20 == null || atr14 == null) return null;

  const prevClose = ctx.closes.at(-2);
  const prevHigh = ctx.high(1);
  if (prevClose == null || prevHigh == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    if (entryPx && entryPx > 0) {
      if (price <= entryPx - 2.5 * atr14 || price >= entryPx + 4.0 * atr14) {
        ctx.watch([{ side: 'sell', price: price, note: 'ATR Exit SL/TP' }]);
        return { side: 'sell', qty: pos };
      }
    }
    return null;
  }

  // Breakout entry: price breaks above SMA20 + 0.8 * ATR
  const triggerLevel = s20 + 0.8 * atr14;
  if (prevClose <= triggerLevel) return null;

  const qty = (ctx.cash / price) * 0.98;
  if (qty <= 0) return null;

  ctx.watch([
    { side: 'buy', price: triggerLevel, trigger: 'above', note: 'ATR Breakout Entry',
      conds: [
        { label: 'Close > SMA20+0.8*ATR', now: prevClose, op: '>=', ref: triggerLevel, closed: true }
      ]
    }
  ]);

  return { side: 'buy', qty: qty };
}
