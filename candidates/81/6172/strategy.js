/*
 * @coinsori-strategy v1
 * name: BTC 4H Dual-EMA50/200 Futures
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends in both directions on the 4h chart. A slow EMA50/200 cross on the perpetual captures the full bull AND bear legs with only a handful of trades, so fees and whipsaws cannot eat the edge the way fast breakouts do.
 * When it buys and sells: buys when the 50-bar EMA crosses above the 200-bar EMA (closed bars); sells short when it crosses below. Exits on the opposite cross or a 3xATR hard stop.
 * When it does NOT work: in a long sideways range the two EMAs cross back and forth and each pair of trades pays the spread; the 3xATR stop also locks in losses on the violent start of a new trend.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  const e50p = ctx.ema(50, 2);
  const e200p = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (e50 == null || e200 == null || e50p == null || e200p == null || atr == null) return null;

  // Crosses use only CLOSED bars (ago 1 vs 2) so backtest/live/paper agree.
  const goldCross = e50p <= e200p && e50 > e200;
  const deathCross = e50p >= e200p && e50 < e200;

  const longStop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
  const shortStop = ctx.entryPx != null ? ctx.entryPx + 3 * atr : null;

  if (ctx.position === 0) {
    ctx.watch([
      { side: 'buy', price: e200, trigger: 'above', note: 'golden cross', conds: [{ label: 'EMA50>EMA200', ok: e50 > e200 }] },
      { side: 'sell', price: e200, trigger: 'below', note: 'death cross', conds: [{ label: 'EMA50<EMA200', ok: e50 < e200 }] }
    ]);
    if (goldCross) return { side: 'buy', qty: ctx.cash / ctx.price };
    if (deathCross) return { side: 'sell', qty: ctx.cash / ctx.price };
    return null;
  }

  if (ctx.position > 0) {
    const watchArr = [{ side: 'sell', price: e200, trigger: 'below', note: 'death cross exit' }];
    if (longStop != null) watchArr.push({ side: 'sell', price: longStop, trigger: 'below', note: '3xATR stop' });
    ctx.watch(watchArr);
    if (deathCross) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (longStop != null && ctx.price <= longStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Short position (ctx.position < 0): buy back to close.
  const watchArr = [{ side: 'buy', price: e200, trigger: 'above', note: 'golden cross exit' }];
  if (shortStop != null) watchArr.push({ side: 'buy', price: shortStop, trigger: 'above', note: '3xATR stop' });
  ctx.watch(watchArr);
  if (goldCross) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
  if (shortStop != null && ctx.price >= shortStop) return { side: 'buy', qty: -ctx.position, reduceOnly: true };
  return null;
}
