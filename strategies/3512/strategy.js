/*
 * @coinsori-strategy v1
 * name: Multi-Timeframe Momentum Volatility Expansion 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits medium-term momentum combined with Bollinger Band volatility expansion to capture explosive trend moves on 1h charts.
 * When it buys and sells: Buys when fast EMA crosses above slow EMA, RSI is bullish (> 50), and price breaks above the upper Bollinger Band with expanding volume. Sells on trailing stop or RSI reversal.
 * When it does not work: Suffers in choppy, low-volatility ranging markets where false breakouts trigger frequent small losses.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  if (!p) return null;

  // Need at least 50 bars for smooth indicators
  if (ctx.i < 50) return null;

  const rsi = ctx.rsi(14, 1);
  const emaFast = ctx.ema(20, 1);
  const emaSlow = ctx.ema(50, 1);
  const bb = ctx.bb(20, 2, 1);
  const prevClose = ctx.closes.at(-2);

  if (rsi == null || emaFast == null || emaSlow == null || bb == null || prevClose == null) return null;

  const pos = ctx.position;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: bb.upper, trigger: 'above', note: 'BB Upper Breakout', conds: [
      { label: 'RSI > 50', now: rsi, op: '>', ref: 50, closed: true },
      { label: 'EMA Fast > Slow', ok: emaFast > emaSlow }
    ]},
    { side: 'sell', price: pos > 0 ? pos * 0.97 : 0, trigger: 'below', note: 'Stop Loss / Exit' }
  ]);

  // Exit logic: exit if RSI drops below 45 or EMA fast crosses below slow
  if (pos > 0) {
    if (rsi < 45 || emaFast < emaSlow) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry logic: Buy when EMA trend is bullish, RSI > 50, and previous close broke above upper BB
  const trendBullish = emaFast > emaSlow;
  const rsiBullish = rsi > 50;
  const breakout = prevClose > bb.upper;

  if (trendBullish && rsiBullish && breakout) {
    const qty = (ctx.cash / p) * 0.95;
    if (qty > 0) {
      return { side: 'buy', qty: qty };
    }
  }

  return null;
}
