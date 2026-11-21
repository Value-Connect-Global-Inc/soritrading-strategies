/*
 * @coinsori-strategy v1
 * name: BTC Trend + Dollar Regime 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * BTC 4h trend following gated by the US dollar regime: a rising dollar is a
 * headwind for risk assets, a falling dollar a tailwind. Go long when the trend
 * is up and the dollar is not strong; go short when the trend is down and the
 * dollar is strong. Exit when the trend or the dollar regime flips, or at a stop.
 * Does not work in choppy sideways markets where the 200-bar average whipsaws.
 */
function onUpdate(ctx) {
  const s200 = ctx.sma(200, 1);
  if (s200 == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2); // last CLOSED bar — same in backtest, paper and live
  const trendUp = prevClose > s200;

  // Dollar regime: EWMA z-score of the Fed broad dollar index (positive = strong dollar)
  const q = ctx.data("base_usd_broad");
  if (q == null) {
    ctx.watch([]);
    return null;
  }
  const alpha = 1 / 120; // ~20 days of 4h bars — "recent" dollar regime, not the full history
  const prevMean = ctx.state.dMean != null ? ctx.state.dMean : q;
  const prevVar = ctx.state.dVar != null ? ctx.state.dVar : 0;
  const newMean = prevMean + alpha * (q - prevMean);
  const newVar = (1 - alpha) * (prevVar + alpha * (q - prevMean) * (q - newMean));
  ctx.state.dMean = newMean;
  ctx.state.dVar = newVar;
  const sd = Math.sqrt(newVar);
  const z = sd > 0 ? (q - newMean) / sd : 0;

  const dollarStrong = z > 0.5; // dollar more than half a std above its recent mean = headwind

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  const watch = [];

  if (pos > 0) {
    const stop = entryPx != null ? entryPx * 0.94 : null; // 6% hard stop on every long
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'stop loss' });
    watch.push({ side: 'sell', price: s200, trigger: 'below', note: 'trend down exit', conds: [{ label: 'or dollar strong', ok: dollarStrong }] });
    ctx.watch(watch);
    if (!trendUp || dollarStrong) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos < 0) {
    const stop = entryPx != null ? entryPx * 1.06 : null; // 6% hard stop on every short
    if (stop != null) watch.push({ side: 'buy', price: stop, trigger: 'above', note: 'stop loss' });
    watch.push({ side: 'buy', price: s200, trigger: 'above', note: 'trend up exit', conds: [{ label: 'or dollar weak', ok: !dollarStrong }] });
    ctx.watch(watch);
    if (trendUp || !dollarStrong) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (stop != null && price >= stop) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // flat: entry triggers on the SMA200 cross, dollar regime is a gate condition
  watch.push({ side: 'buy', price: s200, trigger: 'above', note: 'SMA200 up', conds: [{ label: 'dollar not strong', ok: !dollarStrong }] });
  watch.push({ side: 'sell', price: s200, trigger: 'below', note: 'SMA200 down', conds: [{ label: 'dollar strong', ok: dollarStrong }] });
  ctx.watch(watch);

  if (trendUp && !dollarStrong) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
  }
  if (!trendUp && dollarStrong) {
    return { side: 'sell', qty: (ctx.cash / price) * 0.9 };
  }
  return null;
}
