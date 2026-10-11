/*
 * @coinsori-strategy v1
 * name: Keltner Channel Mean Reversion 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Exploits price overextensions outside the Keltner Channel during high volatility periods on 4h charts, buying oversold dips that revert to the EMA midline.
 * When it buys and sells: Buys when price dips below the lower Keltner band and RSI is oversold. Sells when price returns to the EMA midline or a tight stop-loss triggers.
 * When it does not work: Suffers during strong structural downtrends where price continues to make lower lows outside the bands without meaningful rebounds.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;
  
  // Read indicators with sufficient history guard (EMA 20, ATR 14, RSI 14)
  const ema20 = ctx.ema(20, 1);
  const atr14 = ctx.atr(14, 1);
  const rsi14 = ctx.rsi(14, 1);
  const high1 = ctx.high(1);
  const low1 = ctx.low(1);
  const close1 = ctx.closes.at(-2);
  
  if (ema20 == null || atr14 == null || rsi14 == null || close1 == null) return null;
  
  // Define Keltner Channel bands (Multiplier = 2.5)
  const multiplier = 2.5;
  const upperBand = ema20 + (multiplier * atr14);
  const lowerBand = ema20 - (multiplier * atr14);
  
  // Watchlist declaration for live / paper display
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'Keltner Lower Band', conds: [
      { label: 'RSI(14)', now: rsi14, op: '<', ref: 35, closed: true },
      { label: 'Price < Lower Band', ok: close1 < lowerBand }
    ]},
    { side: 'sell', price: ema20, trigger: 'above', note: 'EMA Midline Target' }
  ]);
  
  // Exit Logic if in position
  if (pos > 0) {
    // Take profit at EMA midline or stop loss if price drops further by 3x ATR
    if (p >= ema20 || (ctx.entryPx && p <= ctx.entryPx - (3.0 * atr14))) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }
  
  // Entry Logic: Buy when previous close breached lower Keltner band and RSI is deeply oversold
  if (close1 < lowerBand && rsi14 < 35) {
    const qty = (ctx.cash / p) * 0.95;
    if (qty > 0) {
      return { side: 'buy', qty: qty };
    }
  }
  
  return null;
}
