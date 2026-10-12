/*
 * @coinsori-strategy v1
 * name: SOL Mean-Reversion Dip 1H
 * ex: binance
 * syms: SOL/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: in a solid uptrend, SOL's sharp 1-hour pullbacks usually
 *   snap back to the mean. We buy only dips that happen inside an uptrend and
 *   take the bounce, instead of trying to catch every move.
 * When it buys and sells: buy when 1h RSI(14) closes below 32 while price is
 *   still above its 200-EMA (a dip inside an uptrend); sell when the bounce
 *   pushes RSI back above 55 or price falls 2x ATR below entry (hard stop).
 * When it does NOT work: in a real downtrend it stays out of the market, and
 *   in a crash the 2x ATR stop takes a loss before the bounce happens. It needs
 *   a trending-up market with healthy pullbacks, not a bear market.
 */
function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || ema200 == null || atr == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    // exit when the bounce is done: RSI recovered above 55 on a closed bar
    if (rsi >= 55) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR hard stop' }]);
    return null;
  }

  if (prevClose <= ema200) return null;   // only buy dips inside an uptrend (falling 200-EMA = downtrend)
  if (rsi >= 32) return null;             // wait for a real oversold close — RSI<32 is the dip signal

  // risk 1% of cash on a 2x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'oversold RSI entry' }]);
  return { side: 'buy', qty };
}
