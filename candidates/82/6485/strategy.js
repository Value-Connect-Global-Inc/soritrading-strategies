/*
 * @coinsori-strategy v1
 * name: ETH Trend Ride ATR-Trail 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On the 4h chart crypto trends persist for days to weeks once
 * they start, so riding a trend while it lasts captures most of the move. Exiting
 * only when the trend itself breaks lets a strong bull run be held to its end
 * instead of being shaken out by an early trailing stop.
 * When it buys and sells: Buy when price is above the 50-EMA and the 50-EMA is
 * above the 200-SMA (a confirmed uptrend). Sell when price closes below the
 * 200-SMA (the trend is broken).
 * When it does NOT work: In a sideways or choppy market the trend signals
 * whipsaw and the strategy pays fees without progress; in a fast crash it exits
 * late relative to a short. It also sits out flat in bear markets, which is
 * safer but means it never profits from falling prices.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const ema50 = ctx.ema(50, 1);
  const sma200 = ctx.sma(200, 1);
  if (ema50 == null || sma200 == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  if (pos > 0) {
    const trendBreak = prevClose < sma200;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }
    ]);
    if (trendBreak) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const trendUp = prevClose > ema50 && ema50 > sma200;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'above EMA50 in uptrend', conds: [
    { label: 'EMA50 vs SMA200', now: ema50, op: '>', ref: sma200, closed: true }
  ] }]);
  if (trendUp) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
