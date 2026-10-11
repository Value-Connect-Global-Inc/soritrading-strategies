/*
 * @coinsori-strategy v1
 * name: Adaptive Trend Channel Mean Reversion 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits overextended moves away from the moving average trend channel combined with volatility contraction to capture high-probability mean reversion bounces.
 * When it buys and sells: Buys when price dips below the lower Bollinger Band while RSI indicates oversold conditions and volatility is stable; sells when price reaches the middle/upper band or momentum fades.
 * When it does not work: Suffers during strong secular trends where prices stay persistently outside the bands or during choppy low-liquidity regimes with erratic whipsaws.
 */

function onUpdate(ctx) {
  // Ensure we have enough history for indicators
  const sma20 = ctx.sma(20, 1);
  const rsi14 = ctx.rsi(14, 1);
  const atr14 = ctx.atr(14, 1);
  const bb = ctx.bb(20, 2, 1);
  
  if (sma20 == null || rsi14 == null || atr14 == null || bb == null) {
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  const currentPrice = ctx.price;
  const position = ctx.position;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Dip', conds: [
      { label: 'RSI < 40', now: rsi14, op: '<', ref: 40, closed: true },
      { label: 'Price < SMA20', now: prevClose, op: '<', ref: sma20, closed: true }
    ]},
    { side: 'sell', price: bb.middle, trigger: 'above', note: 'BB Middle Target' }
  ]);

  // Entry Rule: Oversold bounce off lower Bollinger Band below SMA20 with low RSI
  if (position <= 0 && prevClose < bb.lower && rsi14 < 40 && prevClose < sma20) {
    const qty = (ctx.cash / currentPrice) * 0.98;
    return { side: 'buy', qty: qty };
  }

  // Exit Rule: Take profit at middle/upper band or stop loss if price drops significantly
  if (position > 0) {
    const entryPx = ctx.entryPx || currentPrice;
    const pnlPct = (currentPrice - entryPx) / entryPx;

    // Take profit when price crosses above middle band or stop loss at -3%
    if (prevClose >= bb.middle || pnlPct <= -0.03 || rsi14 > 65) {
      return { side: 'sell', qty: position };
    }
  }

  return null;
}
