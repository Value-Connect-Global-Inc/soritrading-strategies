/*
 * @coinsori-strategy v1
 * name: BTC EMA Pullback MR ATR Stop 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Improvement of 5760 (validated winner). In an uptrend, sharp pullbacks to a rising short-term average are temporary — price reverts to the mean. Change: replace the fixed 15% hard stop with an ATR-adaptive stop (3x ATR below entry) so the stop scales with volatility instead of being blind to it.
 * When it buys and sells: Buy when price <= EMA20 with RSI(14)<35 and 200-bar average rising (bull gate). Sell when price reverts above EMA20, or on a 3xATR trailing stop below entry.
 * When it does NOT work: In a bear market the trend gate stays flat (good); a strong bull that never dips under EMA20 is missed; sharp V-reversals can hit the stop before reversion plays out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || rsi == null || sma200 == null || sma200prev == null || atr == null) return null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx - 3 * atr : null; // 3x ATR below entry, volatility-adaptive
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'revert to EMA20' },
      { side: 'sell', price: stop, trigger: 'below', note: '3xATR stop' }
    ]);
    if (stop != null && price < stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (price > ema20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const trendUp = sma200 > sma200prev;
  ctx.watch([
    { side: 'buy', price: ema20, trigger: 'below', note: 'pullback to EMA20', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]}
  ]);
  if (price <= ema20 && rsi < 35 && trendUp) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  return null;
}
