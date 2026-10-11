/*
 * @coinsori-strategy v1
 * name: Adaptive Volatility Squeeze Momentum Strategy
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Assets often consolidate in tight volatility ranges before explosive directional breakouts, which can be captured by tracking Bollinger Band contraction and MACD momentum alignment.
 * When it buys and sells: Buys when Bollinger Band width is relatively tight and MACD crosses above its signal line; sells when price falls below the middle band or MACD crosses down.
 * When it does not work: Suffers in choppy, range-bound markets with false breakouts where volatility contraction is followed by immediate whipsaws.
 */

function onUpdate(ctx) {
  if (ctx.i < 40) return null;

  const close = ctx.price;
  const bbNow = ctx.bb(20, 2, 0);
  const bbPrev = ctx.bb(20, 2, 1);
  const macdNow = ctx.macd(12, 26, 9, 0);
  const macdPrev = ctx.macd(12, 26, 9, 1);
  const sma20 = ctx.sma(20, 0);
  const rsi = ctx.rsi(14, 0);

  if (!bbNow || !bbPrev || !macdNow || !macdPrev || sma20 == null || rsi == null) return null;

  const bwNow = (bbNow.upper - bbNow.lower) / bbNow.middle;
  
  // Simplified squeeze: band width < 0.08 (8%)
  const isSqueezed = bwNow < 0.08;
  const pos = ctx.position;

  const macdCrossUp = macdPrev.macd <= macdPrev.signal && macdNow.macd > macdNow.signal;

  if (pos <= 0 && (isSqueezed || macdCrossUp) && rsi > 40) {
    const qty = (ctx.cash * 0.99) / close;
    ctx.watch([
      { side: 'buy', price: close, trigger: 'above', note: 'Squeeze/Momentum entry', conds: [
        { label: 'RSI > 40', now: rsi, op: '>', ref: 40, closed: true }
      ]}
    ]);
    return { side: 'buy', qty: qty };
  }

  const macdCrossDown = macdPrev.macd >= macdPrev.signal && macdNow.macd < macdNow.signal;
  if (pos > 0 && (close < sma20 || macdCrossDown)) {
    ctx.watch([
      { side: 'sell', price: close, trigger: 'below', note: 'Exit on SMA20 loss or MACD cross', conds: [
        { label: 'Close < SMA20', now: close, op: '<', ref: sma20, closed: true }
      ]}
    ]);
    return { side: 'sell', qty: pos };
  }

  ctx.watch([
    { side: 'buy', price: bbNow.lower, trigger: 'below', note: 'Waiting for volatility expansion', conds: [
      { label: 'RSI', now: rsi, op: '>', ref: 40, closed: true }
    ]}
  ]);

  return null;
}
