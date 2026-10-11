/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A real breakout above a 20-bar high marks the start of a strong move,
 *   and a 3x ATR chandelier stop rides the trend while cutting losers fast. This tests a
 *   different trend mechanism (price breakout) than the EMA-crossover champion, on BTC.
 * When it buys and sells: buys when the last CLOSED bar breaks above the highest high of
 *   the 20 bars BEFORE it while price is above SMA200 (uptrend only). Sells when price
 *   falls 3x ATR below the highest high of the last 20 bars (chandelier trailing stop).
 * When it does NOT work: in a choppy range every small breakout is immediately stopped
 *   out — many small losses. It also whipsaws badly when BTC grinds sideways for months.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const hiEntry = ctx.high(20, 2); // highest high of the 20 bars BEFORE the last closed bar
  const hiNow = ctx.high(20, 1);   // highest high of the last 20 closed bars (incl. last)
  if (atr == null || sma200 == null || hiEntry == null || hiNow == null) return null;
  const price = ctx.price;
  const closes = ctx.closes;
  if (closes.length < 22) return null;
  const prevClose = closes.at(-2);

  if (ctx.position > 0) {
    // chandelier trailing stop: 3x ATR below the highest 20-bar high
    const stopPx = hiNow - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'chandelier stop' }]);
    return null;
  }

  // entry: closed-bar break above prior 20-bar high + price above SMA200 (uptrend)
  if (prevClose > hiEntry && prevClose > sma200) {
    // size so the 3x ATR stop loses ~2% of cash (can't ruin account)
    const riskCash = ctx.cash * 0.02;
    const stopDist = 3 * atr;
    let qty = stopDist > 0 ? riskCash / stopDist : 0;
    const maxQty = (ctx.cash * 0.99) / price;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }
  return null;
}
