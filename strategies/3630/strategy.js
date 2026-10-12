/*
 * @coinsori-strategy v1
 * name: BTC Trend 4H No-Gate Control
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: control group for 3629. Identical 20-bar breakout engine
 *   with the hashrate gate removed, so we can measure whether the gate adds
 *   value or just rides the trend engine.
 * When it buys and sells: buy a 20-bar high close above the 100-EMA with
 *   above-average volume. Sell on a 20-bar low close, a 2.5x ATR hard stop,
 *   or a close back below the 100-EMA.
 * When it does NOT work: same as any breakout follower — whipsaws in chop and
 *   late entries into reversals.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema100) return { side: 'sell', qty: ctx.position };
    return null;
  }

  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
