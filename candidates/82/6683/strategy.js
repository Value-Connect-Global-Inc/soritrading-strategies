/*
 * @coinsori-strategy v1
 * name: SOL Trend-Retracement 1D
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: altcoins in a clear uptrend tend to keep rising, and buying a pullback inside the uptrend gets a better entry than chasing the high.
 * When it buys and sells: buys SOL when price is above its 50-day average (uptrend) and RSI has pulled back below 45 (not overbought); sells when price drops 20% from the highest close since entry (trailing stop) or closes back below the 50-day average.
 * When it does NOT work: in a sharp risk-off crash price gaps straight through the trailing stop, and in a sideways market the 50-day cross whipsaws and pays fees without progress.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema50 == null || rsi == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  // restart-safe state: highest close since entry
  let peak = ctx.state.peak;
  if (pos > 0) {
    const prevClose = ctx.closes.at(-2);
    if (peak == null || prevClose > peak) peak = prevClose;
    ctx.state.peak = peak;
  } else {
    ctx.state.peak = null;
  }

  const stop = (peak != null) ? peak * 0.80 : null; // 20% trailing stop

  if (pos > 0) {
    // exit on trailing stop or trend break
    if (stop != null) ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop 20%' },
      { side: 'sell', price: ema50, trigger: 'below', note: 'EMA50 break' }
    ]);
    if (price < ema50) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // entry: uptrend + pullback
  if (price > ema50 && rsi < 45) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'pullback entry' }]);
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up' }]);
  return null;
}
