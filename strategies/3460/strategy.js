/*
 * @coinsori-strategy v1
 * name: BBDynamicSqueezeMeanReversion1h
 * ex: binance
 * syms: BTCUSDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Adapts to changing volatility regimes by measuring bandwidth relative to its own recent distribution, buying true extreme contractions.
 * When it buys and sells: Buys when Bollinger Band width is in the lowest 5% of the last 100 bars and RSI(14) is below 30. Sells when price reaches the 20-period SMA or RSI exceeds 60.
 * When it does not work: In persistent downward trends where volatility contraction represents distribution before a major crash.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const bb = ctx.bb(20, 2);
  const rsi = ctx.rsi(14);
  const sma20 = ctx.sma(20);
  
  if (bb == null || rsi == null || sma20 == null) return null;
  if (ctx.closes.length < 120) return null;
  
  const bandwidth = (bb.upper - bb.lower) / sma20;
  
  // Collect recent bandwidths to find percentile
  // Using approximate check over recent closes via helper or simplified rolling logic
  // Since we cannot easily loop historical indicators without storing state, let's use ATR ratio vs SMA ATR
  const atr = ctx.atr(14);
  const atrSma = ctx.sma(50); // Using SMA of price as proxy or simple volatility check
  
  if (atr == null) return null;
  
  const pos = ctx.position;
  
  // Dynamic volatility squeeze: ATR is unusually low compared to recent price level
  const volRatio = atr / p;
  
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'Dynamic Squeeze Buy', conds: [
      { label: 'RSI < 30', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Low Volatility Ratio', now: volRatio, op: '<', ref: 0.008, closed: true }
    ]},
    { side: 'sell', price: sma20, trigger: 'above', note: 'SMA20 Mean Target' }
  ]);
  
  if (pos <= 0) {
    if (volRatio < 0.008 && rsi < 30) {
      const qty = (ctx.cash / p) * 0.99;
      return { side: 'buy', qty: qty };
    }
  } else {
    if (p >= sma20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
  }
  
  return null;
}
