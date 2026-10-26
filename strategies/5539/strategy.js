/*
 * @coinsori-strategy v1
 * name: BTC Yield-Curve-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the slope of the US yield curve (10Y minus 2Y) is a
 * leading macro signal for liquidity and recession risk. When the curve is
 * positively sloped (not inverted), the monetary backdrop is risk-on and a
 * BTC breakout is more likely to persist; when it is inverted, recessions
 * historically follow and risk assets struggle.
 * When it buys and sells: buys when the daily close makes a new 20-day high
 * AND the 10Y-2Y spread is positive (risk-on curve). Sells when the close
 * breaks below the 10-day low or price falls 2.5x ATR below entry as a
 * safety stop.
 * When it does NOT work: in sideways chop it whipsaws; the curve is a slow
 * signal so it cannot time short-term bounces inside a bear market; it is
 * always long or flat, so it cannot profit from falling markets.
 */
function onUpdate(ctx) {
  const ENTRY_N = 20;    // breakout lookback in days
  const EXIT_N = 10;     // exit lookback in days
  const ATR_STOP = 2.5;  // hard stop: 2.5x daily ATR below entry
  const RISK = 0.02;     // fraction of equity risked per trade

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const breakoutHigh = ctx.high(ENTRY_N, 2);
  const exitLow = ctx.low(EXIT_N, 2);
  const atr = ctx.atr(14, 1);
  if (breakoutHigh == null || exitLow == null || atr == null) return null;

  // ---- yield-curve regime: 10Y-2Y spread (FRED, lag applied, no lookahead) ----
  const curve = ctx.data('base_t10y2y');
  if (curve == null) return null; // no rate data yet -> stay out
  const riskOn = curve > 0;       // positive slope = not inverted = risk-on

  const pos = ctx.position || 0;
  const price = ctx.price;

  // ---- EXIT ----
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stopPx = entry - ATR_STOP * atr;
    ctx.watch([
      { side: 'sell', price: exitLow, trigger: 'below', note: '10d low exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (prevClose < exitLow || price <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- ENTRY: breakout + risk-on curve ----
  if (prevClose > breakoutHigh && riskOn) {
    const riskAmt = ctx.cash * RISK;
    const stopDist = ATR_STOP * atr;
    if (stopDist <= 0) return null;
    const qty = Math.min(riskAmt / stopDist, (ctx.cash / price) * 0.98);
    if (qty <= 0) return null;
    ctx.watch([{
      side: 'buy', price: breakoutHigh, trigger: 'above', note: '20d high + curve risk-on',
      conds: [{ label: '10Y-2Y>0', ok: riskOn, closed: true }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: breakoutHigh, trigger: 'above', note: '20d high breakout' }]);
  return null;
}
