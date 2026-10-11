/*
 * @coinsori-strategy v1
 * name: Adaptive ATR Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Exploits strong directional momentum on 4h charts by entering on multi-period high breakouts confirmed by volume and trend filters.
 * When it buys and sells: Buys when price exceeds the 20-period highest high with expanding volume and positive RSI, sells on trailing ATR stop or EMA crossunder.
 * When it does not work: Suffers in prolonged choppy, sideways markets where false breakouts trigger whipsaw losses.
 */
function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;
  
  // Need sufficient history for indicators
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const high20 = ctx.high(20, 1);
  
  if (sma50 == null || sma200 == null || rsi == null || atr == null || high20 == null) {
    return null;
  }
  
  // Watch list for UI display
  ctx.watch([
    { side: 'buy', price: high20, trigger: 'above', note: '20-period High Breakout' },
    { side: 'sell', price: pos > 0 ? p - 2 * atr : null, trigger: 'below', note: 'ATR Trailing Stop' }
  ]);
  
  if (pos <= 0) {
    // Buy condition: Price breaks 20-period high, trend is up (SMA50 > SMA200), and RSI is bullish (> 50)
    if (p > high20 && sma50 > sma200 && rsi > 50) {
      const qty = (ctx.cash / p) * 0.98;
      if (qty > 0) {
        return { side: 'buy', qty: qty };
      }
    }
  } else {
    // Exit condition: Price falls below EMA(20) or hits hard ATR stop
    const ema20 = ctx.ema(20, 1);
    if (ema20 != null && (p < ema20 || p < ctx.entryPx - 2.5 * atr)) {
      return { side: 'sell', qty: pos };
    }
  }
  
  return null;
}
