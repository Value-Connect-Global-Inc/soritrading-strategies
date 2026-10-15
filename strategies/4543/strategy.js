/*
 * @coinsori-strategy v1
 * name: Donchian + ATR Risk-Sized v3 (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same Donchian 55/20 close breakout as the validated
 * champion, but position size is scaled by volatility (ATR) so a 2xATR adverse
 * move costs a fixed fraction of equity. Risk appetite 8% deploys most of the
 * capital while ATR still trims size in high-volatility periods.
 * When it buys and sells: buys when the close makes a new 55-day high. Sells on
 * a 2xATR stop, a 20-day close low, or a 20-day time stop.
 * When it does NOT work: choppy sideways markets whipsaw; in fast crashes the
 * 20-day low exit lags and the 2xATR stop takes the hit. Higher risk appetite
 * means bigger swings than the 5% version in those regimes.
 */
function onUpdate(ctx) {
  const RISK_PCT = 0.08; // 8% of equity risked per trade — near full deployment, ATR trims in high-vol
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes[n - 2];

  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  let lo20 = Infinity;
  for (let i = n - 2 - 20; i <= n - 3; i++) {
    if (closes[i] < lo20) lo20 = closes[i];
  }

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr; // 2xATR stop (risk = RISK_PCT of equity)
    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos };
    const held = ctx.state.entryI != null ? ctx.i - ctx.state.entryI : 0;
    if (held >= 20) return { side: 'sell', qty: pos }; // time stop: no 20d low in 20 days
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '2xATR stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: 'exit: 20d low',
                 conds: [{ label: 'close vs 20d low', ok: prevClose >= lo20, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > hi55;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  // size so a 2xATR adverse move costs RISK_PCT of equity (volatility-scaled)
  const riskPerTrade = ctx.cash * RISK_PCT;
  const qty = riskPerTrade / (2 * atr);
  if (qty <= 0) return null;
  ctx.state.entryI = ctx.i;
  return { side: 'buy', qty };
}
