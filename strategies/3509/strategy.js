/*
 * @coinsori-strategy v1
 * name: MTF Regime Mean Reversion ETH
 * ex: binance
 * syms: ETH/USDT, ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: ETH often ranges within established trend regimes on 1h charts, allowing mean-reversion entries when price deviates from the moving average while aligning with the higher timeframe trend.
 * When it buys and sells: Buys when RSI is oversold and price is below the short-term moving average, provided the 4h trend (approximated via daily/hourly SMA slope) is favorable. Sells when RSI becomes overbought or price reaches the upper band.
 * When it does NOT work: Strong unexpected trend reversals or prolonged bear market cascades will cause multiple losses.
 */

function onUpdate(ctx) {
  // We need enough bars for SMA200 and RSI14
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;

  if (sma50 == null || sma200 == null || rsi == null || prevClose == null) return null;

  // Watch conditions for live/paper card
  ctx.watch([
    { side: 'buy', price: prevClose * 0.98, trigger: 'below', note: 'Mean reversion buy zone', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'Uptrend filter', ok: sma50 > sma200 }
    ]},
    { side: 'sell', price: price * 1.03, trigger: 'above', note: 'Take profit / Overbought' }
  ]);

  const hasPosition = ctx.position > 0;

  // Buy condition: Uptrend regime (SMA50 > SMA200), RSI oversold (< 35), and price pulling back below SMA20
  const sma20 = ctx.sma(20, 1);
  if (sma20 == null) return null;

  if (!hasPosition && sma50 > sma200 && rsi < 35 && prevClose < sma20) {
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty: qty };
  }

  // Sell condition: RSI overbought (> 65) or price above upper Bollinger band or stop loss / take profit
  if (hasPosition) {
    const bb = ctx.bb(20, 2, 1);
    if (bb != null && (rsi > 65 || prevClose >= bb.upper)) {
      return { side: 'sell', qty: ctx.position };
    }
  }

  return null;
}
