/*
 * @coinsori-strategy v1
 * name: Fng Trend Follow ATR Optimized
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Combines daily trend structure with alternative sentiment (Fear & Greed Index) and dynamic ATR trailing stop management.
 * When it buys and sells: Buys when price is above SMA50 and Fear & Greed index indicates moderate-to-high market confidence without being overheated, exiting on ATR trailing stop breaks.
 * When it does not work: Suffers in prolonged sideways chop or sudden macro trend reversals where sentiment lags price action.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const sma50 = ctx.sma(50);
  const atr14 = ctx.atr(14);
  const fgVal = ctx.data('fear_greed');

  if (sma50 == null || atr14 == null || fgVal == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx || p;

  // Track trailing stop
  if (pos > 0) {
    const stopPrice = entryPx - (atr14 * 2.5);
    ctx.watch([
      { side: 'buy', price: p, trigger: 'above', note: 'Holding Trend' },
      { side: 'sell', price: stopPrice, trigger: 'below', note: 'ATR Trailing Stop' }
    ]);

    if (p < stopPrice) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry condition: price above SMA50 and Fear & Greed between 40 and 80
  const trendOk = p > sma50;
  const sentimentOk = fgVal >= 40 && fgVal <= 80;

  ctx.watch([
    {
      side: 'buy',
      price: p,
      trigger: 'above',
      note: 'F&G Trend Entry',
      conds: [
        { label: 'Price > SMA50', ok: trendOk },
        { label: 'F&G Index 40-80', now: fgVal, op: '>=', ref: 40, closed: true }
      ]
    }
  ]);

  if (trendOk && sentimentOk) {
    const qty = (ctx.cash / p) * 0.99;
    if (qty > 0) {
      return { side: 'buy', qty: qty };
    }
  }

  return null;
}
