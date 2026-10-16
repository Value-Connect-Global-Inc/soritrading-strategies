/*
 * @coinsori-strategy v1
 * name: TrendStrength EMA50/200 4H Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the EMA50/200 trend core is the one family with repeated
 * out-of-sample evidence in this environment (4-coin basket +285/+112/+57% on
 * three disjoint 4h windows). Its known weakness is whipsaw: in a choppy
 * sideways range the EMAs barely cross and the 2.5-ATR stop turns small dips
 * into realized losses. This version adds a trend-strength filter — the fast
 * EMA must sit at least 1 ATR above the slow EMA before a new long is opened —
 * so only established trends are bought, not hairline crossovers.
 * When it buys and sells: on each asset, buy when the 50-period EMA is above
 * the 200-period EMA by at least 1 ATR (or a fresh bullish cross that already
 * has that separation), while flat and past cooldown. Sell on a death cross or
 * when price falls 2.5 ATR below the entry price. Re-entry waits 24 bars
 * (4 days) after an exit.
 * When it does NOT work: in a long choppy sideways range where EMAs stay
 * within 1 ATR of each other it simply stays in cash and misses the chop's
 * small recoveries; long-only means a sustained bear market is flat-to-loss,
 * and it lags a fast V-shaped recovery after a crash.
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
  if (!st.cool) st.cool = {}; // per-symbol cooldown bar index after an exit

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    // Fixed stop from entry, as in the validated core — a trailing stop gets
    // stopped out on pullbacks inside an intact trend and churns fees.
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    if (f <= s) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; } // death cross -> trend over
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR from entry' }]);
    return null;
  }

  // Cooldown: wait 24 bars (4 days) after an exit before re-entering this
  // asset, otherwise a choppy market churns fees.
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  // Entry: fresh bullish cross, OR re-entry while the trend is intact — BUT
  // only when the trend is actually strong. Requiring the fast EMA to sit at
  // least 1 ATR above the slow EMA filters out the hairline crossovers that
  // whipsaw in chop (the champion's known failure mode).
  let enter = false;
  if (f > s && (f - s) > atr) enter = true;
  else if (fp <= sp && f > s && (f - s) > atr) enter = true;
  if (!enter) return null;

  // Size: risk a small fixed share of the per-symbol cash on the stop distance
  // so a wide-stop trade cannot ruin the account. 1% per asset across 4 assets.
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
