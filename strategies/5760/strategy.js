/*
 * @coinsori-strategy v1
 * name: BTC EMA Pullback Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an established uptrend, sharp pullbacks to a rising short-term average are temporary — buyers step in and price reverts to the mean. This family is positive on BTC 4h with low drawdown; the 200-bar rising average gate keeps it out of bear markets.
 * When it buys and sells: Buy when price is at or below the 20-bar EMA, RSI(14) < 35, and the 200-bar average is rising (bull regime gate). Sell when price climbs back above the 20-bar EMA, or on a 15% hard stop.
 * When it does NOT work: In a bear market the trend gate keeps it mostly flat (good), but a strong bull that never pulls back under the EMA20 will be missed. Sharp V-reversals down can hit the 15% stop before the EMA20 reversion plays out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || rsi == null || sma200 == null || sma200prev == null) return null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.85 : null; // 15% hard stop
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'revert to EMA20' },
      { side: 'sell', price: stop, trigger: 'below', note: '15% hard stop' }
    ]);
    if (entryPx != null && price < entryPx * 0.85) {
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
