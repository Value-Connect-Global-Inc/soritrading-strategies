/*
 * @coinsori-strategy v1
 * name: BTC Mean-Reversion Dips 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a healthy uptrend BTC pulls back to oversold and then bounces. Buying those
 * oversold dips (mean reversion) is the opposite of trend-following: it buys weakness inside an
 * uptrend instead of buying strength. The 200-bar SMA gate keeps us out of bear markets where an
 * oversold reading just means the fall continues (no catching falling knives).
 * When it buys and sells: Buy when the last closed 4h close is above a RISING 200-bar SMA AND RSI(14)
 * is oversold (below 30). Sell when RSI recovers above 55 (the bounce is done), or the close falls
 * back below the 200-bar SMA (the uptrend broke), or price drops 3x the 14-bar ATR from entry.
 * When it does NOT work: In a strong one-way rally the price rarely gets oversold, so this sits in
 * cash and misses most of the rise (loses to holding in a bull run). In a long sideways range RSI
 * whipsaws around 30 and each dip costs fees. If the uptrend is very young (SMA still falling) it
 * refuses to buy and misses the bottom of a new trend.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  const pos = ctx.position || 0;

  // hard volatility stop: 3x ATR from entry, only fires in fast crashes
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    // exit: bounce done (RSI>55) or uptrend broke (close < SMA200)
    ctx.watch([
      { side: 'sell', price: prevClose, trigger: 'above', note: 'RSI bounce done', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] },
      { side: 'sell', price: sma, trigger: 'below', note: 'SMA200 broke exit' }
    ]);
    if (rsi > 55 || prevClose < sma) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat: buy only oversold dips inside a rising uptrend
  const rising = sma > smaPrev;
  ctx.watch([{ side: 'buy', price: prevClose, trigger: 'below', note: 'oversold dip', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
    { label: 'SMA200 rising', ok: rising }
  ] }]);
  if (rising && rsi < 30 && prevClose > sma) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
