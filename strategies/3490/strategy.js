/*
 * @coinsori-strategy v1
 * name: AdaptiveEmaRsiStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures medium-term trend continuations by entering on fast/slow EMA crossovers confirmed by an RSI momentum filter.
 * When it buys and sells: Buys when the 9 EMA crosses above the 21 EMA while RSI is above 50; sells when the 9 EMA crosses below the 21 EMA or RSI drops below 40.
 * When it does not work: Suffers in choppy, sideways markets where frequent false crossovers cause whipsaw losses.
 */

function onUpdate(ctx) {
  // Read indicators with sufficient warm-up checks
  const emaFast1 = ctx.ema(9, 1);
  const emaSlow1 = ctx.ema(21, 1);
  const emaFast2 = ctx.ema(9, 2);
  const emaSlow2 = ctx.ema(21, 2);
  const rsi1 = ctx.rsi(14, 1);
  
  if (emaFast1 == null || emaSlow1 == null || emaFast2 == null || emaSlow2 == null || rsi1 == null) {
    return null;
  }
  
  // Watch status for live/paper card
  ctx.watch([
    { side: 'buy', price: ctx.price, trigger: 'above', note: 'EMA 9/21 Bullish Crossover', conds: [
      { label: 'RSI > 50', now: rsi1, op: '>', ref: 50, closed: true }
    ]},
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'EMA 9/21 Bearish Crossover or RSI < 40' }
  ]);
  
  const isGoldenCross = (emaFast2 <= emaSlow2) && (emaFast1 > emaSlow1);
  const isDeathCross = (emaFast2 >= emaSlow2) && (emaFast1 < emaSlow1);
  
  // Buy logic: Golden cross and RSI > 50
  if (ctx.position <= 0 && isGoldenCross && rsi1 > 50) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    return { side: 'buy', qty: qty };
  }
  
  // Sell logic: Death cross or RSI < 40 while holding position
  if (ctx.position > 0 && (isDeathCross || rsi1 < 40)) {
    return { side: 'sell', qty: ctx.position };
  }
  
  return null;
}
