/*
 * @coinsori-strategy v1
 * name: BTC VIX-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that does best when equity fear is
 * low. The VIX (a daily, always-available base indicator) measures that fear:
 * when VIX is below its own 60-day average, the risk environment is calm and a
 * BTC breakout is more likely to persist. In high-fear regimes the exit is
 * tightened (7-day low instead of 10-day low) because fear-driven markets
 * reverse faster.
 * When it buys and sells: buys when the daily close makes a new 20-day high AND
 * VIX is below its 60-day average (calm risk mood). Sells when the close
 * breaks below a trailing low (10-day in calm, 7-day in fear) or price falls
 * 2.5x ATR below entry as a safety stop.
 * When it does NOT work: in sideways chop it whipsaws; if BTC rallies into a
 * VIX spike (panic-driven) it stays out too long; it is always long or flat, so
 * it cannot profit from falling markets.
 */
function onUpdate(ctx) {
  const ENTRY_N = 20;    // breakout lookback in days
  const EXIT_CALM = 10;  // trailing exit lookback in calm risk mood
  const EXIT_FEAR = 7;   // tighter trailing exit in fear mood (fear reverses faster)
  const VIX_N = 60;     // VIX average window
  const ATR_STOP = 2.5;  // hard stop: 2.5x daily ATR below entry
  const RISK = 0.02;     // fraction of equity risked per trade

  // closed-bar values only (ago>=1 is identical in backtest and live)
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const breakoutHigh = ctx.high(ENTRY_N, 2); // highest high of previous 20 closed bars
  const exitLowCalm = ctx.low(EXIT_CALM, 2); // trailing low in calm mood
  const exitLowFear = ctx.low(EXIT_FEAR, 2); // trailing low in fear mood
  const atr = ctx.atr(14, 1);
  if (breakoutHigh == null || exitLowCalm == null || exitLowFear == null || atr == null) return null;

  // ---- VIX regime: accumulate base_vix history in ctx.state, rolling on bar change ----
  const s = ctx.state;
  const vixNow = ctx.data('base_vix');
  if (vixNow == null) return null; // no VIX data yet -> stay out

  // on a new bar, push the previous VIX into the rolling history
  if (s.lastBarI !== ctx.i) {
    if (s.lastVix != null) {
      s.hist = s.hist || [];
      s.hist.push(s.lastVix);
      if (s.hist.length > VIX_N) s.hist.shift();
    }
    s.lastBarI = ctx.i;
  }
  s.lastVix = vixNow;

  // need enough VIX history to form a 60-day average
  const hist = s.hist || [];
  if (hist.length < 30) return null;
  let sum = 0;
  for (let k = 0; k < hist.length; k++) sum += hist[k];
  const vixAvg = sum / hist.length;
  const calmRisk = vixNow < vixAvg;

  const pos = ctx.position || 0;
  const price = ctx.price;

  // ---- EXIT ----
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stopPx = entry - ATR_STOP * atr;
    // tighter exit in fear: fear-driven markets reverse faster, protect gains sooner
    const exitLow = calmRisk ? exitLowCalm : exitLowFear;
    ctx.watch([
      { side: 'sell', price: exitLow, trigger: 'below', note: exitLow === exitLowCalm ? '10d low exit' : '7d low exit (fear)' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (prevClose < exitLow || price <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- ENTRY: breakout + calm risk mood ----
  if (prevClose > breakoutHigh && calmRisk) {
    // size so a stop-out (ATR_STOP*ATR move) loses RISK of equity
    const riskAmt = ctx.cash * RISK;
    const stopDist = ATR_STOP * atr;
    if (stopDist <= 0) return null;
    const qty = Math.min(riskAmt / stopDist, (ctx.cash / price) * 0.98);
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: breakoutHigh, trigger: 'above', note: '20d high + VIX calm' }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: breakoutHigh, trigger: 'above', note: '20d high breakout' }]);
  return null;
}
