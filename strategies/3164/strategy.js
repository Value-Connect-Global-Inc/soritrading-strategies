/*
 * BTC 200-Day Trend Hysteresis 7% 1D
 * Idea: same as 3162 but with a 7% band — robustness check that the edge
 * is not a knife-edge at exactly 5%.
 * 2026-04-08 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const holding = ctx.position > 0;

  if (!holding) {
    const buyLevel = sma200 * 1.07;
    ctx.watch([{ side: 'buy', price: buyLevel, trigger: 'above', note: 'breakout above 200d' }]);
    if (price > buyLevel) {
      return { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
  } else {
    const sellLevel = sma200 * 0.93;
    ctx.watch([{ side: 'sell', price: sellLevel, trigger: 'below', note: 'exit below 200d' }]);
    if (price < sellLevel) {
      return { side: 'sell', qty: ctx.position };
    }
  }
  return null;
}
