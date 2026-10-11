/*
 * @coinsori-strategy v1
 * name: DXY-Filtered Donchian
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated Donchian breakout edge is real, but this version
 * adds a macro regime filter — crypto tends to rally when the dollar is weak and
 * stall when the dollar is strong. Bet: only take breakouts when the macro wind is
 * not blowing against you.
 * When it buys and sells: buys when the last close breaks above the prior 55-bar
 * high, price is above the 200 SMA, AND the dollar index is below its own 200-bar
 * average (weak dollar). Sells on a 20-bar channel low or a 2.5x ATR hard stop.
 * When it does NOT work: the DXY filter can keep you out of early-stage rallies
 * that start while the dollar is still strong. In long sideways ranges breakouts
 * get bought at the top and stopped out. Long-only means a sustained bear is flat.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const hh55 = ctx.high(55, 2);   // highest high of the 55 bars BEFORE the last close
  const ll20 = ctx.low(20, 2);    // lowest low of the 20 bars BEFORE the last close
  const sma200 = ctx.sma(200, 1);
  const dxy = ctx.data('dxy');
  if (atr == null || hh55 == null || ll20 == null || sma200 == null || dxy == null) return null;

  // rolling 200-bar average of the dollar index, kept in state (ctx.data has no 'ago')
  const arr = ctx.state.dxyArr || (ctx.state.dxyArr = []);
  arr.push(dxy);
  if (arr.length > 200) arr.shift();
  let dxySma = null;
  if (arr.length >= 200) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    dxySma = s / arr.length;
  }
  if (dxySma == null) return null;

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
  // macro filter: skip breakouts while the dollar is strong (above its own 200-bar average)
  if (dxy >= dxySma) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
