/*
 * BTC 200-Day Trend Hysteresis 1D
 * Idea: plain 200-SMA whipsaws in choppy markets (re-enters on every fake
 * breakout). Adding a 5% band around the SMA means we only enter on a clear
 * breakout above SMA*1.05 and only exit below SMA*0.95 — fewer, stronger trades.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) {
    ctx.watch([]);
    return null;
  }

  const holding = ctx.position > 0;

  if (!holding && price > sma200 * 1.05) {
    ctx.watch([{ side: 'buy', price: sma200 * 1.05, trigger: 'above', note: '200d breakout entry' }]);
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  if (holding && price < sma200 * 0.95) {
    ctx.watch([{ side: 'sell', price: sma200 * 0.95, trigger: 'below', note: '200d exit' }]);
    return { side: 'sell', qty: ctx.position };
  }
  ctx.watch([]);
  return null;
}
