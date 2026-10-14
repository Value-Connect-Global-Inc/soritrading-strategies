/*
 * @coinsori-strategy v1
 * name: BTC Vol-Target Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Long-term trend following on Bitcoin works, but full-size
 *   entries get destroyed by Bitcoin's violent corrections. Instead of betting
 *   the same amount every time, this strategy scales its position DOWN when
 *   volatility is high (inverse-ATR sizing) so a single crash cannot ruin the
 *   account. The 200-day average is the regime filter: only trade above it.
 * When it buys and sells: buys when price closes above the 200-day average
 *   (long-term uptrend intact), sized so that a 3x ATR move risks ~2% of cash.
 *   Sells when price closes back below the 200-day average, or on a 3x ATR hard
 *   stop from entry.
 * When it does NOT work: in a long sideways chop around the 200-day average the
 *   filter whipsaws; in a sustained bear market it sits in cash the whole time
 *   (safe, but no upside). It also lags a straight-line melt-up because vol-
 *   targeting keeps size smaller when volatility is high.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null || atr <= 0) return null;

  // long-term regime: only hold long while price is above its 200-day average
  const trendUp = prevClose > sma200;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 3 * atr;   // 3x ATR hard stop: caps a single-position loss
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (!trendUp) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: '200d regime break' }]);
    return null;
  }

  if (!trendUp) return null;

  // inverse-ATR sizing: risk 2% of cash on the 3x ATR stop, so high-vol entries get smaller
  const riskCash = ctx.cash * 0.02;
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
