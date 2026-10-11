/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A different family from trend-following — mean reversion.
 *   In an intact long-term uptrend (price above the 200 SMA), sharp pullbacks to the
 *   lower Bollinger band with an oversold RSI tend to bounce. Bet: BTC pullbacks
 *   inside an uptrend mean-revert more than they break down.
 * When it buys and sells: buys when the last CLOSED bar closes below the lower
 *   Bollinger band while RSI(14) drops under 30 and price is above the 200 SMA.
 *   Sells when price climbs back to the 20 SMA (the pullback has mean-reverted) or
 *   on a hard 2x ATR stop below entry. Stays in cash in bear markets (below 200 SMA).
 * When it does NOT work: in a genuine breakdown (uptrend failing), every "cheap" dip
 *   keeps falling and the 2x ATR stop bleeds; mean reversion is the opposite bet of
 *   the breakout family — they complement each other, they do not both win.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const bb = ctx.bb(20, 2, 1);      // Bollinger band of the last CLOSED bar
  const rsi = ctx.rsi(14, 1);       // closed-bar RSI so backtest == live
  const sma200 = ctx.sma(200, 1);
  const sma20 = ctx.sma(20, 1);
  if (atr == null || bb == null || rsi == null || sma200 == null || sma20 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2 * atr;   // hard stop: 2x ATR is the mean-reversion thesis failing
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (price >= sma20) return { side: 'sell', qty: ctx.position };  // mean reversion target = back to the 20 SMA
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma20, trigger: 'above', note: 'mean-revert to 20 SMA' }]);
    return null;
  }

  // entry: closed bar closes below the lower BB and RSI is oversold, but only in an uptrend
  if (prevClose > bb.lower) return null;
  if (rsi > 30) return null;
  if (prevClose <= sma200) return null;   // no buying dips in a bear market

  const riskCash = ctx.cash * 0.02;       // risk 2% of cash per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
