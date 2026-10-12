/*
 * @coinsori-strategy v1
 * name: FearGreedContrarianSOL
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment (Fear & Greed index) swings to extremes; buying during extreme fear while the long-term trend is still intact has historically offered good reward for risk.
 * When it buys and sells: Buys SOL when the Fear & Greed index is at extreme fear (<=20) and price is above the 200-day average. Sells when sentiment turns greedy (>=70) or the position falls 30% below entry.
 * When it does NOT work: In a long bear market price stays below the 200-day average, so the strategy stays in cash and misses the recovery; a sudden deep crash can still hit the 30% stop.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fg');
  if (fg == null) return null; // sentiment data missing — do nothing rather than guess
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const price = ctx.price;

  // Exit logic first
  if (ctx.position > 0) {
    const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.70 : null; // 30% stop: SOL daily swings are wide, tighter stops get shaken out
    const watches = [];
    if (stopPx != null) watches.push({ side: 'sell', price: stopPx, trigger: 'below', note: '30% stop' });
    watches.push({ side: 'sell', note: 'greed exit', conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 70, closed: true }] });
    ctx.watch(watches);

    if (fg >= 70) return { side: 'sell', qty: ctx.position }; // sentiment turned greedy — take profit
    if (stopPx != null && price <= stopPx) return { side: 'sell', qty: ctx.position };
    return null;
  }

  // Flat: wait for extreme fear while the 200d uptrend holds
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SOL above 200d', conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 20, closed: true }] }
  ]);

  if (fg <= 20 && price > sma200) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
