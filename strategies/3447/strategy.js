/*
 * @coinsori-strategy v1
 * name: Volatility Breakout ATR DXY BTC
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Exploits strong directional breakouts when price exceeds recent high/low channels accompanied by favorable macro liquidity (DXY falling or stable).
 * When it buys and sells: Buys when price breaks above the 20-period highest high and DXY macro condition is benign; sells when ATR trailing stop or channel lower bound is hit.
 * When it does not work: Suffers in choppy, range-bound markets with false breakouts and whipsaws.
 */

function onUpdate(ctx) {
  // Guard warm-up period for indicators
  const sma200 = ctx.sma(200);
  const atr = ctx.atr(14);
  const high20 = ctx.high(20, 1);
  const low20 = ctx.low(20, 1);
  const dxy = ctx.macro('dxy');
  
  if (sma200 == null || atr == null || high20 == null || low20 == null) return null;
  
  const price = ctx.price;
  const pos = ctx.position;
  const cash = ctx.cash;
  
  // Watch list for UI display
  ctx.watch([
    { side: 'buy', price: high20, trigger: 'above', note: '20-bar High Breakout' },
    { side: 'sell', price: low20, trigger: 'below', note: '20-bar Low Exit / Stop' }
  ]);
  
  // If we are flat, look for breakout entry
  if (pos <= 0) {
    // Breakout condition: price crosses above 20-period high, and price is above SMA200 for macro trend alignment
    if (price > high20 && price > sma200) {
      // Risk management sizing: 98% of available cash
      const qty = (cash / price) * 0.98;
      return { side: 'buy', qty: qty };
    }
  } else {
    // If long, exit if price drops below the 20-period low or hits an ATR trailing stop
    if (price < low20) {
      return { side: 'sell', qty: pos };
    }
  }
  
  return null;
}
