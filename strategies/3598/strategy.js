/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A different trend family than the EMA crossover — the classic
 *   turtle channel breakout. It only re-enters on a FRESH 20-bar high break, so it
 *   cannot form the exit-whipsaw loop that killed the EMA core when a trailing stop
 *   was added. Bet: sustained crypto trends start with a break of the recent range.
 * When it buys and sells: buys when the last close breaks above the highest high of
 *   the prior 55 bars (turtle long system), and only when price is above the 200 SMA
 *   (don't fight the long-term trend). Sells when the close breaks below the lowest
 *   low of the prior 20 bars, or on a hard 2.5x ATR stop from entry.
 * When it does NOT work: in long sideways ranges breakouts get bought at the top of
 *   the range and stop out repeatedly; long-only means a sustained bear market is
 *   flat-to-loss.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const hh55 = ctx.high(55, 2);   // highest high of the 55 bars BEFORE the last close
  const ll20 = ctx.low(20, 2);    // lowest low of the 20 bars BEFORE the last close
  const sma200 = ctx.sma(200, 1);
  if (atr == null || hh55 == null || ll20 == null || sma200 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  // entry: last close breaks the prior 55-bar high, only above the 200 SMA (trend filter)
  if (prevClose <= hh55) return null;
  if (prevClose <= sma200) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
