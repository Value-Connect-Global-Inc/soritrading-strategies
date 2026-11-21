/*
 * @coinsori-strategy v1
 * name: BTC Dip-Buy Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto bull markets, sharp dips to oversold are usually
 * bought back up quickly — the crowd panic-sells into a still-rising trend.
 * Instead of following the trend (buying strength), this strategy buys the
 * weakness inside an uptrend and sells the bounce.
 * When it buys and sells: buy when BTC is above its 200-EMA (long-term uptrend)
 * and RSI(14) drops below 30 (oversold dip). Sell when RSI recovers above 55
 * (bounce complete) or price closes below the 200-EMA (trend broken — the dip
 * was the start of a real fall).
 * When it does NOT work: in a long bear market price stays below the 200-EMA so
 * it never buys (good), but in a choppy sideways market just above the EMA it
 * can take many small losing dips. It also gives up part of a straight melt-up
 * because it only enters on weakness.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema200 == null || rsi == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  const aboveTrend = prevClose != null && prevClose > ema200;
  const brokeTrend = prevClose != null && prevClose < ema200;

  if (pos > 0) {
    const rsiNow = ctx.rsi(14, 1);
    const exitRsi = rsiNow != null && rsiNow > 55;
    // Exit either when the bounce completes (RSI back above 55) or when the
    // long-term trend breaks (the dip was not a dip but a real fall).
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'close < EMA200 (trend broken)', conds: [{ label: 'RSI(14) close', now: rsiNow, op: '>', ref: 55, closed: true }] }
    ]);
    if (brokeTrend || exitRsi) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const oversold = rsi < 30;
  // Only buy dips inside a confirmed uptrend (price above 200-EMA). Buying
  // oversold below the trend is catching a falling knife in a bear market.
  ctx.watch([
    { side: 'buy', price: ema200, trigger: 'above', note: 'close above EMA200 + RSI oversold', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }
  ]);
  if (aboveTrend && oversold) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
