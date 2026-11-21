/*
 * @coinsori-strategy v1
 * name: BTC Trend + Yield-Curve Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends for weeks on the 4h chart, but the size of those
 * trends is set by the macro risk mood. When the US yield curve is deeply
 * inverted (10Y minus 2Y very negative), risk assets historically struggle and
 * BTC trends are short and choppy. We keep the proven trend + constant-risk
 * sizing core and gate it with the curve so we skip the worst macro regimes.
 * When it buys and sells: buys when price closes ABOVE the 200-bar average
 * (no longer waiting for the average to turn up, so it catches bull recoveries
 * earlier) AND the 10Y-2Y curve is not deeply inverted; position is sized so the
 * risk per bar is constant (smaller when volatility is high); sells when price
 * closes below the 200-bar average or on a 30% hard stop.
 * When it does NOT work: near the 200-bar line it whipsaws and pays fees; the
 * curve is a slow signal with a ~2-day lag, so it cannot catch fast crypto
 * crashes; in a straight-up bull market constant-risk sizing holds less during
 * the exciting (high-volatility) legs, so pure buy-and-hold can beat it.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);        // trend line, closed bar
  const atr = ctx.atr(14, 1);         // 4h volatility, closed bar
  const curve = ctx.data("base_t10y2y"); // 10Y-2Y spread in %, lag ~2 days
  if (sma == null || atr == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;

  const RISK_BUDGET = 0.010;  // 1% of account at risk per 4h bar (constant-risk sizing)
  const MAX_QTY_FRAC = 0.98;  // never use more than 98% of cash
  const MIN_QTY_FRAC = 0.05;  // never go below 5% even in extreme vol
  const STOP_PCT = 0.70;      // hard stop: sell if price falls 30% below entry
  const CURVE_OK = -0.50;     // allow longs only when 10Y-2Y is above -0.50% (not deeply inverted)

  // ---- while holding: exits ----
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'Trend exit below SMA200' },
      { side: 'sell', price: entry * STOP_PCT, trigger: 'below', note: 'Hard stop -30%' },
    ]);
    if (price < sma) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= entry * STOP_PCT) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: enter above the trend line, gated by the yield curve ----
  const curveOk = curve != null ? curve > CURVE_OK : true; // unknown curve = do not block entry
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Above SMA200 + curve not inverted' }]);
  if (price > sma && curveOk) {
    const atrPct = atr / price;
    let frac = atrPct > 0 ? RISK_BUDGET / atrPct : MAX_QTY_FRAC;
    if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
    if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;
    return { side: 'buy', qty: (ctx.cash / price) * frac };
  }
  return null;
}
