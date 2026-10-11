/*
 * @coinsori-strategy v1
 * name: ETH Donchian Plain 4H (baseline)
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: EXACT copy of the validated BTC Donchian champion (3598) but
 *   on ETH, kept as the baseline so the volume filter in 3606 can be judged
 *   fairly — same entry, same exit, only the volume condition differs.
 * When it buys and sells: buys when the last close breaks above the prior 55-bar
 *   high and price is above the 200 SMA. Sells on a 2.5x ATR hard stop or a 20-bar
 *   channel exit.
 * When it does NOT work: long sideways ranges stop out breakouts; long-only loses
 *   in a sustained bear.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const hh55 = ctx.high(55, 2);
  const ll20 = ctx.low(20, 2);
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
