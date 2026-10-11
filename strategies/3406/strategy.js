/*
 * @coinsori-strategy v1
 * name: BTC Funding Trend-Confirmation 1D
 * ex: binanceusdm
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Uses futures funding as TREND CONFIRMATION (not contrarian).
 * Positive funding means leveraged longs are paying to stay long — the crowd is
 * putting money behind the rally, which typically confirms an ongoing uptrend
 * rather than predicting a reversal. Hypothesis: entering a long only when funding
 * is positive AND price is above its 50-day average rides trends that have real
 * leveraged conviction behind them, and exiting when funding turns negative
 * catches the moment conviction flips.
 * When it buys and sells: buys when funding is positive (leveraged longs paying)
 * AND a closed bar closes above its 50-day average. Sells when funding turns
 * negative (conviction gone) or price falls 2.5 ATR below entry.
 * When it does NOT work: In a late-stage blow-off top, funding stays very positive
 * right up to the crash — the strategy holds into the top. In a quiet bull with
 * near-zero funding it may never trigger. Funding data missing on some periods —
 * then it does nothing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  if (closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  const sma50 = ctx.sma(50, 1);
  if (atr == null || atr <= 0 || sma50 == null) return null;

  const funding = ctx.funding;
  const fOk = funding != null && Number.isFinite(funding);

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    // Exit when leveraged conviction flips negative OR price breaks the stop.
    const convictionGone = fOk && funding < 0;
    if (convictionGone || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  // Entry: positive funding (longs paying) + above 50-day trend.
  const longsPaying = fOk && funding > 0;
  if (longsPaying && prevClose > sma50) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
