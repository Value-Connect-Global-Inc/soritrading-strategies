/*
 * @coinsori-strategy v1
 * name: BTC DXY Macro Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A different family from price-action — macro regime. BTC has a
 *   strong historical inverse relationship with the US Dollar index (DXY): when the
 *   dollar is weak (risk-on), capital flows into BTC; when the dollar strengthens,
 *   risk assets fall. Bet: trading BTC only when the dollar is weakening captures the
 *   crypto uptrends and avoids the dollar-driven selloffs.
 * When it buys and sells: buys when DXY is falling (current below previous bar) AND
 *   the last BTC close is above the 50 EMA (uptrend confirmed). Sells when the close
 *   falls below the 50 EMA, or DXY turns up, or on a 2.5x ATR hard stop.
 * When it does NOT work: when BTC and DXY decouple (crypto-specific crashes like
 *   2022's FTX/Luna while the dollar was flat), the DXY filter adds nothing and the
 *   EMA exit carries all the risk. DXY data is daily, so signals lag.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');           // dollar index value (daily series); null when unknown
  const atr = ctx.atr(14, 1);
  const ema50 = ctx.ema(50, 1);
  if (dxy == null || atr == null || ema50 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  // track previous bar's DXY so we can compare current vs previous (direction of dollar)
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) { s.prevDxy = s.curDxy ?? null; s.lastBarI = ctx.i; }
  s.curDxy = dxy;
  if (s.prevDxy == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema50) return { side: 'sell', qty: ctx.position };
    if (dxy > s.prevDxy) return { side: 'sell', qty: ctx.position };   // dollar strengthening = risk-off
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50 EMA exit' }]);
    return null;
  }

  // entry: dollar weakening (DXY falling) + BTC in uptrend
  if (dxy >= s.prevDxy) return null;
  if (prevClose <= ema50) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
