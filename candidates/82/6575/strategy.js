/*
 * @coinsori-strategy v1
 * name: BTC Nasdaq Risk-On Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin increasingly trades as a high-beta risk asset — it rallies when global
 * equity risk appetite (NASDAQ-100) is strong and breaks down when equity investors turn risk-off.
 * Instead of a hard on/off switch, this uses NDX as a SIZE dial: stay in BTC's uptrend, but run at
 * half size while equity risk appetite is off (NDX below its own 60-day average). That keeps most of
 * the upside of an uptrend while cutting exposure right before equity-led selloffs.
 * When it buys and sells: Buy BTC with the whole account when the last closed daily close is above a
 * RISING 200-day SMA. While holding, run at FULL size when NDX is above its own 60-day average
 * (risk-on) and HALF size when NDX is below it (risk-off) — the position is rebalanced when the NDX
 * regime flips. Sell everything when the close falls below the SMA, or on a 5x ATR hard stop.
 * When it does NOT work: NDX is daily and lags by 2 days, so a crypto-only crash that happens before
 * the stock market reacts is not caught early (the SMA filter catches it later). In a long flat range
 * the price crosses the SMA and each crossing costs fees. In crypto-only bull markets while stocks are
 * weak (rare decoupling), the risk-off gate keeps us at half size and we miss part of the rally.
 * Long-only: it misses short-side profit in bear markets.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // NDX risk-on/off: current NDX vs its own trailing 60-day average. Relative to its own mean, not a
  // fixed level, because what matters is whether equity risk appetite is improving or deteriorating.
  // Unknown (null) is treated as "no signal" — full size, never a forced exit.
  const ndx = ctx.data('base_ndx');
  const st = ctx.state;
  let ndxRiskOn = null;
  if (ndx != null) {
    const hist = st.ndxHist || [];
    hist.push(ndx);
    if (hist.length > 60) hist.shift();
    st.ndxHist = hist;
    if (hist.length >= 60) {
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      ndxRiskOn = ndx > avg;
    }
  }
  const sizeFactor = (ndxRiskOn === false) ? 0.5 : 1.0; // half size when equity risk appetite is off

  const pos = ctx.position || 0;
  const equity = ctx.cash + pos * ctx.price; // total value, not just free cash
  const targetQty = (equity / ctx.price) * 0.99 * sizeFactor;

  // wide hard stop: 5x ATR so normal 1d pullbacks do not whipsaw us out of a trend
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 5 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const exitPx = sma * (1 - band);

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: exitPx, trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'NDX risk-off half', conds: [{ label: 'NDX risk-on', ok: ndxRiskOn === false }] },
      { side: 'buy', price: prevClose, trigger: 'above', note: 'NDX risk-on top-up', conds: [{ label: 'NDX risk-on', ok: ndxRiskOn === true }] }
    ]);
    if (prevClose < exitPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (pos > targetQty * 1.05) return { side: 'sell', qty: pos - targetQty, reduceOnly: true };
    if (pos > 0 && pos < targetQty * 0.95) return { side: 'buy', qty: targetQty - pos };
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long' }]);
  if (rising && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: targetQty };
  }
  return null;
}
