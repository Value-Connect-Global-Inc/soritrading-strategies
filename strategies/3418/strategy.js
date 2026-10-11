/*
 * @coinsori-strategy v1
 * name: BTC 4H RSI2 Mean Reversion
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: on the 4h timeframe, sharp panic dips (2-period RSI below
 * 10) are usually followed by a bounce — short-term mean reversion is stronger
 * at high frequency than on daily bars where a dip can be a genuine crash.
 * When it buys and sells: buy when a closed bar's RSI(2) < 10. Sell when a
 * closed bar's RSI(2) > 60 or price climbs back above the 20-bar average. A
 * hard 2.5-ATR stop caps each trade.
 * When it does NOT work: in a fast crash the 2.5-ATR stop is hit repeatedly.
 * Long-only. The bounce is small, so fees matter.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 40) return null;
  const prevClose = closes[n - 2];
  if (prevClose == null) return null;

  const rsi2 = ctx.rsi(2, 1);
  const sma20 = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);
  if (rsi2 == null || sma20 == null || atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'mean target' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }
    ]);
    if (rsi2 > 60 || prevClose > sma20 || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (rsi2 < 10) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * 0.5 };
  }
  return null;
}
