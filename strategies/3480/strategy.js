/*
 * @coinsori-strategy v1
 * name: Bollinger RSI Mean Reversion 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits short-term oversold/overbought conditions by buying lower Bollinger Band touches when RSI confirms an oversold state, betting on a return to the moving average.
 * When it buys and sells: Buys when price touches or dips below the lower Bollinger Band and RSI(14) is below 35. Sells when price reaches or crosses above the middle SMA band or RSI(14) exceeds 65.
 * When it does NOT work: Fails during strong, sustained trending markets where price rides the Bollinger Band, causing premature exits or continuing drawdowns.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;

  // Indicators: Bollinger Bands (20, 2) and RSI (14)
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma20 = ctx.sma(20, 1);

  if (!bb || rsi === null || sma20 === null) return null;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Touch', conds: [{ label: 'RSI < 35', now: rsi, op: '<', ref: 35, closed: true }] },
    { side: 'sell', price: sma20, trigger: 'above', note: 'SMA20 Mean Target', conds: [{ label: 'RSI > 65', now: rsi, op: '>', ref: 65, closed: true }] }
  ]);

  // Entry: price below lower BB and RSI oversold
  if (pos <= 0 && price <= bb.lower && rsi < 35) {
    const qty = (ctx.cash / price) * 0.99;
    return { side: 'buy', qty };
  }

  // Exit: price touches middle SMA or RSI overbought
  if (pos > 0 && (price >= sma20 || rsi > 65)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
