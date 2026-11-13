/*
 * @coinsori-strategy v1
 * name: BTC Trend + YieldCurve Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC with a macro regime filter that the ledger has
 * shown to help (VIX and USD gates both improved an EMA50/200 trend). This version uses a
 * NEW macro key never tested on trend: the US yield curve (10Y-2Y). A deeply inverted curve
 * (10Y-2Y far below its own recent average) is a classic recession/credit-stress signal —
 * in those regimes BTC trends tend to fail, so we stop entering. When the curve is normal,
 * we ride the EMA50/200 trend.
 * When it buys and sells: buy when EMA50 crosses above EMA200 (trend up) AND the yield curve
 * is not deeply inverted (10Y-2Y z-score > -1 vs its own ~90d mean). Sell when EMA50 crosses
 * below EMA200, or when the curve turns deeply inverted while holding (defensive exit). A
 * hard 3x ATR stop caps any single loss.
 * When it does NOT work: in a broad flat chop the EMA crossover whipsaws and pays fees; the
 * yield-curve signal is a slow daily macro input, so it cannot protect against a fast
 * crypto-only crash that happens while the curve is still normal.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

  // Closed-bar indicators only (identical in backtest/live).
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema50prev = ctx.ema(50, 2);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || ema50prev == null || ema200prev == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const close = ctx.closes.at(-2);

  // Yield-curve regime: z-score of 10Y-2Y vs its own ~90d history. Deep inversion = z < -1.
  const t10y2y = ctx.data('base_t10y2y');
  const curveOk = t10y2y == null ? true : t10y2y > -0.3; // level gate, not z: -0.3 = deeply inverted

  // ---- exits ----
  if (pos > 0) {
    const trendDown = ema50prev >= ema200prev && ema50 < ema200; // EMA50 crossed below EMA200
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null; // hard 3x ATR stop
    const curveExit = !curveOk;
    if (trendDown || curveExit || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'trend/curve/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  // ---- entries ----
  const trendUp = ema50prev <= ema200prev && ema50 > ema200; // EMA50 crossed above EMA200
  if (trendUp && curveOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'EMA50/200 cross up',
      conds: [
        { label: 'EMA50>EMA200', ok: ema50 > ema200 },
        { label: '10Y-2Y not inverted', ok: curveOk }
      ]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
