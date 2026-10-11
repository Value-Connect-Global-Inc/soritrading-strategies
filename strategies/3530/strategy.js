/*
 * @coinsori-strategy v1
 * name: BTC Trend Volume Confirmation 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Filters out false breakout whipsaws by requiring both a medium-term trend alignment and above-average volume confirmation.
 * When it buys and sells: Buys when price crosses above SMA50 with RSI > 50 and volume > 1.2x its 20-period average. Sells on an ATR trailing stop or when price drops below SMA50.
 * When it does not work: Suffers in choppy, range-bound markets where moving averages constantly whip back and forth.
 */

function onUpdate(ctx) {
  // Need enough history for SMA50, ATR14, and volume average
  if (ctx.i < 50) return null;

  const price = ctx.price;
  const sma50 = ctx.sma(50, 0);
  const sma50Prev = ctx.sma(50, 1);
  const rsi = ctx.rsi(14, 0);
  const atr = ctx.atr(14, 0);
  const avgVol = ctx.avgVol(20);

  if (sma50 == null || sma50Prev == null || rsi == null || atr == null || avgVol == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  // Watch conditions for live/paper display
  if (pos <= 0) {
    ctx.watch([
      { side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 break', conds: [
        { label: 'RSI > 50', now: rsi, op: '>', ref: 50, closed: false },
        { label: 'Vol > 1.2x avg', now: ctx.vol, op: '>', ref: avgVol * 1.2, closed: false }
      ]}
    ]);
  } else {
    const stopPrice = entryPx - (2.5 * atr);
    ctx.watch([
      { side: 'sell', price: stopPrice, trigger: 'below', note: 'ATR Stop', conds: [
        { label: 'Price below SMA50', now: price, op: '<', ref: sma50, closed: false }
      ]}
    ]);
  }

  // Entry Rule: Buy when price crosses above SMA50, RSI > 50, and volume spike
  if (pos <= 0) {
    const prevClose = ctx.closes.at(-2);
    const currClose = ctx.closes.at(-1);
    const crossedAbove = prevClose <= sma50Prev && currClose > sma50;

    if (crossedAbove && rsi > 50 && ctx.vol > avgVol * 1.2) {
      const qty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty };
    }
  }

  // Exit Rule: Sell if price drops below SMA50 or hits ATR stop (2.5x ATR)
  if (pos > 0) {
    const stopPrice = entryPx - (2.5 * atr);
    if (price < stopPrice || price < sma50) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
