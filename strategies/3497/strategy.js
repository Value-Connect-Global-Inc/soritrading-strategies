/*
 * @coinsori-strategy v1
 * name: EMA Trend Momentum BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Captures medium-term trend momentum on Bitcoin 4h charts using exponential moving average crossovers and RSI confirmation.
 * When it buys and sells: Buys when fast EMA crosses above slow EMA and RSI is above 50. Sells when fast EMA crosses below slow EMA.
 * When it does not work: Whipsaw markets with frequent trend reversals.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;

  const fast1 = ctx.ema(20, 1);
  const fast2 = ctx.ema(20, 2);
  const slow1 = ctx.ema(50, 1);
  const slow2 = ctx.ema(50, 2);
  const rsi1 = ctx.rsi(14, 1);

  if (!fast1 || !fast2 || !slow1 || !slow2 || !rsi1) return null;

  if (pos > 0) {
    if (fast1 < slow1) {
      ctx.watch([{ side: 'sell', price: p, trigger: 'below', note: 'EMA bearish cross exit' }]);
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const crossUp = fast2 <= slow2 && fast1 > slow1;
  const rsiOk = rsi1 > 50;

  if (crossUp && rsiOk) {
    const qty = (ctx.cash / p) * 0.99;
    ctx.watch([
      { side: 'buy', price: p, trigger: 'above', note: 'EMA bullish cross buy',
        conds: [
          { label: 'EMA Cross', now: fast1, op: '>', ref: slow1, closed: true },
          { label: 'RSI > 50', now: rsi1, op: '>', ref: 50, closed: true }
        ]
      }
    ]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: p, trigger: 'above', note: 'Waiting for EMA cross' }]);
  return null;
}
