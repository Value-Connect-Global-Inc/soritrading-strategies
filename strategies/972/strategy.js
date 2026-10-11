/*
 * @coinsori-strategy v1
 * name: Bollinger Band Mean Reversion Strategy
 * ex: binanceusdm
 * syms: BTCUSDT
 * interval: 1h
 * cash: 1000
 *
 * This strategy uses Bollinger Bands to identify overbought and oversold conditions for mean reversion trading.
 * It buys when the price touches the lower band and sells when it touches the upper band.
 * The strategy aims to capture volatility-driven price movements within a defined range.
 *
 * When it buys: The price touches the lower Bollinger Band, suggesting an oversold condition and a potential buy signal.
 * When it sells: The price touches the upper Bollinger Band, suggesting an overbought condition and a potential sell signal.
 * When it does NOT work: During strong trending markets or periods of low volatility where the price remains consistently in one direction.
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 */

function onUpdate(ctx) {
  // Bollinger Band parameters
  const bbPeriod = 20;  // Period for the Bollinger Bands
  const bbMultiplier = 2;  // Multiplier for the standard deviation

  // Get the current Bollinger Band values
  const bb = ctx.bb(bbPeriod, bbMultiplier, 0);  // Current (closed) bar
  if (bb == null) {
    ctx.watch([]);
    return null;
  }

  // Check if we are already in a position
  if (ctx.position != 0) {
    // If we have a position, check for exit conditions
    // Exit if we're close to the middle band (mean reversion)
    const currentPrice = ctx.price;
    const middleBand = bb.middle;
    
    // Define thresholds for exiting - close to middle band
    const exitThreshold = 0.01;  // 1% threshold

    // Watch the actual band boundary that triggers the exit
    const exitPx = currentPrice >= middleBand
      ? middleBand * (1 + exitThreshold)
      : middleBand * (1 - exitThreshold);
    const exitTrigger = currentPrice >= middleBand ? 'below' : 'above';

    ctx.watch([
      { side: 'sell', price: exitPx, trigger: exitTrigger, qty: ctx.position, note: 'exit near middle band' }
    ]);

    if (Math.abs(currentPrice - middleBand) / middleBand < exitThreshold) {
      return { side: 'sell', qty: ctx.position };  // Close the position
    }
    
    return null;  // No action if not exiting
  }

  // If no open position, check for entry conditions
  const currentPrice = ctx.price;
  const upperBand = bb.upper;
  const lowerBand = bb.lower;

  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', qty: ctx.cash / ctx.price * 0.99, note: 'buy lower band' },
    { side: 'sell', price: upperBand, trigger: 'above', qty: ctx.position, note: 'sell upper band' }
  ]);

  // Buy when price touches (or goes below) the lower band
  if (currentPrice <= lowerBand) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };  // Enter long position
  }

  // Sell when price touches (or goes above) the upper band
  if (currentPrice >= upperBand) {
    return { side: 'sell', qty: ctx.position };  // Close any existing position (if any)
  }

  return null;  // No action
}
