/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is priced in dollars, and a weakening dollar tends to lift hard assets
 * including crypto, while a strengthening dollar pressures them. This is a cross-asset signal: instead
 * of only looking at BTC's own price, it also checks the direction of the US dollar index. When the
 * dollar is falling from its recent average, BTC up-trends are more likely to continue; when the dollar
 * is climbing, BTC rallies are more fragile.
 * When it buys and sells: Buy BTC with the whole account when the last closed daily close is above a
 * RISING 200-day SMA AND the dollar index is below its own 60-day average (dollar weakening). Sell
 * everything when the close falls below the SMA, or when the dollar rises back above its 60-day average
 * (dollar strengthening) even if the price is still up. A 3x ATR stop closes any position that drops
 * too far from entry.
 * When it does NOT work: The dollar index is daily and lags, so a crypto-only move that happens before
 * the dollar data updates is not caught. In a long flat range the price crosses the SMA and each
 * crossing costs fees. Long-only: it misses short-side profit in bear markets. If the dollar and crypto
 * move together (as in a broad risk-on/risk-off regime), this filter adds little.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Dollar regime: current DXY vs its own trailing 60-day average. dxy < dxySma means the dollar
  // is weakening from its recent level = crypto-friendly. Relative to its own mean, not a fixed
  // level, because the dollar's direction is what matters, not its absolute value.
  const dxy = ctx.data('dxy');
  const st = ctx.state;
  let dxyWeak = false;
  let dxyStrong = false;
  if (dxy != null) {
    const hist = st.dxyHist || [];
    hist.push(dxy);
    if (hist.length > 60) hist.shift();
    st.dxyHist = hist;
    if (hist.length >= 60) {
      const sum = hist.reduce((a, b) => a + b, 0);
      const avg = sum / hist.length;
      dxyWeak = dxy < avg;
      dxyStrong = dxy > avg;
    }
  }

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility hard stop: 3x the 14-bar ATR from entry
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'dollar strong exit', conds: [{ label: 'dollar weak', ok: dxyWeak }] }
    ]);
    if (prevClose < sma * (1 - band) || dxyStrong) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'dollar weak', ok: dxyWeak }] }]);
  if (rising && dxyWeak && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
