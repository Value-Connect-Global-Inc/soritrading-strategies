/*
 * BTC 200-Day Trend 1D
 * Idea: BTC's long-term trend is the strongest signal there is. Stay in the
 * market while price is above its 200-day average, get out when the trend breaks.
 * This is the baseline every regime filter tried to beat.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) {
    ctx.watch([]);
    return null;
  }

  const holding = ctx.position > 0;

  if (holding) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'price < 200d SMA' }]);
  } else {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'price > 200d SMA' }]);
  }

  if (!holding && price > sma200) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  if (holding && price < sma200) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
