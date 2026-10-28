/*
 * @coinsori-strategy v1
 * name: BTC Pure Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Control group — the same 55/20 Donchian breakout WITHOUT the volume filter, to measure what the volume confirmation actually adds.
 * When it buys and sells: Buys when previous close exceeds the 55-bar-high close, sells on 20-day low or 20% stop.
 * When it does NOT work: Control group for comparison only.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (!closes || closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;
  const upper = Math.max(...closes.slice(-57, -2));
  const lower = Math.min(...closes.slice(-22, -2));
  if (ctx.position > 0) {
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null;
    ctx.watch([
      { side: 'sell', price: lower, trigger: 'below', note: '20-day low exit' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (prevClose < lower) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  ctx.watch([{ side: 'buy', price: upper, trigger: 'above', note: '55-day high break' }]);
  if (prevClose > upper) {
    return { side: 'buy', qty: (0.9 * ctx.cash) / ctx.price * 0.99 };
  }
  return null;
}
