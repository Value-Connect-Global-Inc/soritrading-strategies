/*
 * @coinsori-strategy v1
 * name: ETH Yield-Curve Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: An inverted US yield curve (10Y minus 2Y below zero) has historically preceded
 * economic contraction and risk-off in markets, while a positive curve is growth-friendly. Crypto is
 * a high-beta risk asset, so it tends to suffer when the curve signals a coming downturn. This rides
 * ETH's trend but only while the yield curve is not signaling recession, and steps aside when
 * inversion deepens.
 * When it buys and sells: Buy ETH with the whole account when the last closed 4h close is above a
 * RISING 200-bar SMA AND the 10Y-2Y spread is above -0.5% (not deeply inverted). Sell everything when
 * the close falls below the SMA, or when the spread drops below -1.0% (deep inversion = recession
 * risk). A stop closes any position that drops too far from entry — the stop is wider when the yield
 * curve is positive (let winners ride a strong trend) and tighter when it is inverted (protect gains).
 * When it does NOT work: The yield curve is daily, lags by 2 days and changes slowly, so it is a slow
 * macro filter — it cannot time fast crypto moves. It was inverted for long stretches (2022-2023) so
 * it can keep the strategy out of the market for months during a flat or recovering period. Long-only:
 * it misses short-side profit in bear markets and trails buy-and-hold in parabolic melt-ups.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Yield-curve regime filter (daily, 10Y-2Y spread in %). Above -0.5% = not deeply inverted
  // (safe to buy); below -1.0% = deep inversion (recession risk, exit). The gap gives hysteresis
  // so small wiggles around zero do not churn the position.
  const spread = ctx.data('base.t10y2y');
  const notDeepInverted = spread == null ? true : spread > -0.5;
  const deepInverted = spread != null && spread < -1.0;
  const growth = spread == null ? true : spread > 0;   // positive curve = growth regime

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility hard stop: wider (5x ATR) in a growth regime so winners survive normal pullback
  // volatility during a melt-up; tighter (3x ATR) when the curve is inverted to protect gains.
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stopMult = growth ? 5 : 3;
      const stop = ctx.entryPx - stopMult * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'deep inversion exit', conds: [{ label: '10Y2Y < -1%', ok: deepInverted }] }
    ]);
    if (prevClose < sma * (1 - band) || deepInverted) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'not deep inverted', ok: notDeepInverted }] }]);
  if (rising && notDeepInverted && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
