/*
 * @coinsori-strategy v1
 * name: BTC 1D Fed-Easing Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a zero-yield risk asset. When the Fed cuts
 *   rates (easing), money flows into risk assets and BTC trends up; when the
 *   Fed hikes (tightening), BTC usually suffers. We only hold BTC while the
 *   Fed is easing AND price is trending up.
 * When it buys and sells: buy when the Fed funds rate is LOWER than it was 30
 *   days ago (easing) AND price is above its 50-day average; sell when the Fed
 *   turns to hiking, when price closes below its 50-day average, or on a 3x
 *   ATR stop.
 * When it does NOT work: in sustained bull markets while the Fed is neutral or
 *   hiking (e.g. 2017, 2021) the strategy sits in cash and badly lags
 *   buy-and-hold. It is a defensive regime strategy, not a bull-market maximizer.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  const ema50 = ctx.ema(50, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (fed == null || fedLag == null || ema50 == null || sma50 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };     // hard stop
    if (price < ema50) return { side: 'sell', qty: pos };       // trend broken
    if (fed > fedLag) return { side: 'sell', qty: pos };        // Fed turned to hiking
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  if (fed >= fedLag) return null;     // no easing = no long
  if (price <= sma50) return null;    // still falling — don't catch the knife

  const riskCash = ctx.cash * 0.01;      // 1% equity risked per trade
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
