/*
 * @coinsori-strategy v1
 * name: SOL Trend-Follow EMA50/200 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: SOL trends hard in bull markets and the EMA50/200 crossover core already passed on BTC 4h. Re-entering while flat when the trend is still intact captures far more of a sustained move than waiting for a fresh crossover. This applies that proven core to SOL, a higher-beta market.
 * When it buys and sells: It buys on a bullish EMA50/200 crossover above the 200-bar average, and also re-buys while flat if the 50-bar average is above the 200-bar average and price is above the 400-bar average (trend intact). It sells on a death cross or a 2.5 average-range hard stop.
 * When it does NOT work: In choppy sideways ranges the crossover whipsaws and the 2% risk per trade bleeds out slowly. Long-only means a sustained bear market is flat-to-loss. SOL can gap down sharply and the stop exits late.
 */
function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || sma400 == null || atr == null) { ctx.watch([]); return null; }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    if (price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (fp > sp && f <= s) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const forceClosed = !!(ctx.alloc && ctx.alloc.lastForced);
  if (!allocOk || forceClosed) { ctx.watch([]); return null; }

  // entry: fresh bullish cross, OR re-entry while trend intact above SMA400
  let enter = false;
  if (fp <= sp && f > s && prevClose > sma200) enter = true;
  else if (f > s && prevClose > sma400) enter = true;
  if (!enter) { ctx.watch([]); return null; }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'trend up entry' }]);
  const riskCash = ctx.cash * 0.02;   // risk 2% of equity per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
