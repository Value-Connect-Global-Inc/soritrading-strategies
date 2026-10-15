/*
 * @coinsori-strategy v1
 * name: BTC 4h EMA50/200 Momentum with Re-entry (risk 4%)
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On the 4-hour timeframe the 50/200 EMA pair is a proven
 * core momentum signal (ledger: +217% on one window). The edge is that crypto
 * trends persist for days at a time, and a fast 50-EMA pullback exit alone
 * throws you out mid-trend. This version re-enters while flat when the trend
 * is still intact, so it catches the continuation instead of sitting in cash.
 * When it buys and sells: buys when the previous close is above the 50-EMA AND
 * the 50-EMA is above the 200-EMA (trend intact). Sells on a close below the
 * 50-EMA. If flat while the trend is still intact (price above the 200-EMA and
 * 50>200), it re-buys. A 2.5x ATR hard stop protects every position.
 * Positions risk 4% of cash per trade.
 * When it does NOT work: in a choppy sideways market the 50-EMA exit and
 * re-entry churn; and after a genuine trend reversal it re-enters too early
 * because the 200-EMA lags. Trend-following loses in range-bound action.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || atr == null || atr <= 0) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x 4h ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema50) return { side: 'sell', qty: pos };   // momentum broke
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-EMA break (close)' }]);
    return null;
  }

  const trendIntact = ema50 > ema200 && prevClose > ema200;
  const momentumUp = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-EMA',
               conds: [{ label: 'EMA50 > EMA200', ok: ema50 > ema200, closed: true },
                       { label: 'close > 200-EMA', ok: prevClose > ema200, closed: true }] }]);
  if (!momentumUp || !trendIntact) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
