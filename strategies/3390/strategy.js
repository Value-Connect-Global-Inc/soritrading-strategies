/*
 * @coinsori-strategy v1
 * name: ETH Mean Reversion RSI TrendFilter 4H
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, sharp dips are usually temporary and snap back to the
 * mean; in a downtrend they keep falling. So this only buys oversold dips while the longer
 * trend is still up (price above its 200-period average). It fades the dip, then sells as
 * momentum recovers to neutral, with a hard ATR stop if the dip keeps going.
 * When it buys and sells: Buys when a closed 4h bar has RSI(14) below 30 AND price is above
 * its 200-period SMA (uptrend regime). Sells when RSI(14) recovers above 50 or price falls
 * 2x ATR below entry.
 * When it does NOT work: In a choppy sideways market the trend filter lets in dips that never
 * bounce, and it sits in cash through clean bull runs so it underperforms buy-and-hold in a
 * strong uptrend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const n = ctx.closes.length;
  if (n < 220) return null;

  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (rsi == null || sma200 == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    if (atr == null || atr <= 0) return null;
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (rsi > 50 || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Only fade dips that happen inside an uptrend (price above its 200-period average).
  const prevClose = ctx.closes.at(-2);
  const inUptrend = prevClose > sma200;
  if (rsi < 30 && inUptrend) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'above SMA200', ok: inUptrend }], note: 'oversold dip in uptrend' }]);
  return null;
}
