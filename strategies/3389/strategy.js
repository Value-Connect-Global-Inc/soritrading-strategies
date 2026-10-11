/*
 * @coinsori-strategy v1
 * name: ETH Mean Reversion RSI 4H
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: After a sharp sell-off, prices often snap back toward the recent mean
 * before continuing. This bets on that snap-back: it buys only when a closed 4h bar is deeply
 * oversold, holds while the bounce develops, and sells when momentum recovers to neutral.
 * A hard ATR stop caps the damage when the sell-off keeps going instead of reversing.
 * When it buys and sells: Buys when a closed 4h bar has RSI(14) below 30 (deeply oversold).
 * Sells when RSI(14) recovers above 50 (momentum back to neutral) or price falls 2x ATR below
 * the entry price.
 * When it does NOT work: In a strong, sustained downtrend oversold stays oversold — it keeps
 * buying falling knives and every bounce fails. It also sits in cash most of the time, so it
 * misses long bull runs entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const n = ctx.closes.length;
  if (n < 60) return null;

  const rsi = ctx.rsi(14, 1); // closed-bar RSI so live and backtest agree
  if (rsi == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    if (atr == null || atr <= 0) return null;
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr; // 2x ATR: a normal 4h wiggle should not stop us out
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    // Exit when the bounce has recovered to fair value (RSI back above 50) or the stop is hit.
    if (rsi > 50 || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (rsi < 30) {
    ctx.watch([{ side: 'sell', price: price - 2 * (ctx.atr(14, 1) || 0), trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  // Flat: show what we are waiting for (oversold on a closed bar).
  ctx.watch([{ side: 'buy', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }], note: 'oversold dip' }]);
  return null;
}
