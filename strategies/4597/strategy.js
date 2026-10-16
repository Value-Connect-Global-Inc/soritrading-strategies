/*
 * @coinsori-strategy v1
 * name: MultiAsset Trend EMA50/200 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the EMA50/200 trend core is the one family with repeated
 * out-of-sample evidence in this environment (BTC 4h +20/+41/+40%, and
 * +218/+109/+47% once re-entry while the trend is intact is added). This
 * applies that validated core to a 4-coin basket so no single asset decides
 * the account and one coin's crash cannot sink the whole account.
 * When it buys and sells: on each asset, buy when the 50-period EMA is above
 * the 200-period EMA (closed bars), or re-enter while flat when the trend is
 * still intact (EMA50>EMA200 and price above the 400-period average). Sell on
 * a death cross (EMA50 below EMA200) or when price falls 2.5 ATR below the
 * best close since entry (trailing stop).
 * When it does NOT work: in a long choppy sideways range the crossovers
 * whipsaw and the stops turn small dips into realized losses. Long-only means
 * a sustained bear market across all four coins is flat-to-loss. It rides
 * trends, so it also lags a fast V-shaped recovery after a crash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar EMAs so signals are identical in backtest, paper and live.
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma400 == null || atr == null) return null;

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.peak) st.peak = {}; // per-symbol peak so one coin cannot drive another's stop
  const peak = st.peak[sym] || price;

  const pos = ctx.position;
  if (pos > 0) {
    const newPeak = Math.max(peak, price);
    st.peak[sym] = newPeak;
    const stopPx = newPeak - 2.5 * atr; // trail 2.5 ATR below best close since entry
    if (f <= s) return { side: 'sell', qty: pos }; // death cross -> trend over
    if (price <= stopPx) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'trail 2.5 ATR' }]);
    return null;
  }

  // Entry: fresh bullish cross, OR re-entry while the trend is intact.
  let enter = false;
  if (fp <= sp && f > s) enter = true;
  else if (f > s && price > sma400) enter = true;
  if (!enter) return null;

  st.peak[sym] = price;

  // Size: risk a small fixed share of the per-symbol cash on the stop distance
  // so a wide-stop trade cannot ruin the account.
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
