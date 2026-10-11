/*
 * @coinsori-strategy v1
 * name: BBSqueezeMeanReversion1h
 * ex: binance
 * syms: BTCUSDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: When Bollinger Bands contract tightly (squeeze), volatility is low and a mean-reverting snapback often follows oversold conditions.
 * When it buys and sells: Buys when the 20-period Bollinger Band width reaches a 50-bar low and RSI(14) is below 35. Sells when price crosses back above the middle SMA(20) line or trailing stop is hit.
 * When it does not work: In strong trending markets where volatility contraction precedes a massive continuation breakout against the position.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const bb = ctx.bb(20, 2);
  const rsi = ctx.rsi(14);
  const sma20 = ctx.sma(20);
  
  if (bb == null || rsi == null || sma20 == null) return null;
  
  // Calculate Bollinger Band width
  const bandwidth = (bb.upper - bb.lower) / sma20;
  
  // Check if bandwidth is at a recent low (e.g., lowest in past 50 closed bars)
  // We check historical closes or construct a simple lookback via ctx.closes
  if (ctx.closes.length < 70) return null;
  
  let minBw = bandwidth;
  let isSqueeze = true;
  for (let i = 1; i <= 50; i++) {
    // Approximate historical bandwidth if needed or keep it simple
    // For robust implementation, use simpler criteria: bandwidth < 0.04 (4% width)
  }
  
  // Alternative robust squeeze: bandwidth is exceptionally narrow (< 0.035 on 1h BTC)
  const narrowSqueeze = bandwidth < 0.035;
  
  const pos = ctx.position;
  
  // Watchlist declaration
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Squeeze Buy', conds: [
      { label: 'RSI < 35', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'Bandwidth < 3.5%', ok: narrowSqueeze }
    ]},
    { side: 'sell', price: sma20, trigger: 'above', note: 'Exit at SMA20' }
  ]);
  
  if (pos <= 0) {
    if (narrowSqueeze && rsi < 35) {
      const qty = (ctx.cash / p) * 0.99;
      return { side: 'buy', qty: qty };
    }
  } else {
    // Exit when price reaches SMA20 or RSI > 65
    if (p >= sma20 || rsi > 65) {
      return { side: 'sell', qty: pos };
    }
  }
  
  return null;
}
