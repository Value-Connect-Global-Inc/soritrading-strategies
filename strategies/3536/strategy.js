/*
 * @coinsori-strategy v1
 * name: ETH 1h Bollinger Band Mean Reversion
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits short-term overextensions in price relative to volatility bands.
 * When it buys and sells: Buys when price dips below the lower Bollinger Band with supportive RSI, and sells when price reaches the middle SMA or upper band.
 * When it does not work: Fails in strong trending markets where prices ride along the bands continuously.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;
  
  // Need at least 20 bars for Bollinger Bands and RSI
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma20 = ctx.sma(20, 1);
  
  if (bb == null || rsi == null || sma20 == null) return null;
  
  // Watch conditions for live/paper trading
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Dip', conds: [
      { label: 'RSI < 35', now: rsi, op: '<', ref: 35, closed: true }
    ]},
    { side: 'sell', price: sma20, trigger: 'above', note: 'SMA20 Mean Reversion TP', conds: [] }
  ]);
  
  // Entry logic: Buy when price crosses below lower Bollinger Band and RSI is oversold
  if (pos <= 0 && ctx.closes.at(-2) < bb.lower && rsi < 35) {
    const qty = (ctx.cash / p) * 0.98;
    return { side: 'buy', qty: qty };
  }
  
  // Exit logic: Sell when price reaches middle SMA or upper band, or stop loss
  if (pos > 0) {
    if (p >= sma20 || rsi > 65) {
      return { side: 'sell', qty: pos };
    }
  }
  
  return null;
}
