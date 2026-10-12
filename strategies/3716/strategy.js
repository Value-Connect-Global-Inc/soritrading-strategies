/*
 * @coinsori-strategy v1
 * name: Pure200dTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Baseline measurement — the same 200d EMA trend engine with NO hashrate gate,
 * to see whether the onchain gate adds any value over plain long-term trend following. BTC tends to
 * trend strongly once above its 200-day average.
 * When it buys and sells: Buys when the daily close is above the 200-day average. Sells when the
 * close drops below the 200-day average, or a hard 2xATR stop is hit.
 * When it does NOT work: In a long sideways range above the 200-day average it holds through chop
 * and gives back gains; in a violent crash it exits at the 2xATR stop with a loss.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  if (ctx.closes.length < 202) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const pos = ctx.position || 0;

  // Hard stop on every position: 2x ATR below entry (1d bars can gap).
  if (pos > 0 && ctx.entryPx != null) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (px < stopPx) return { side: 'sell', qty: pos };
  }

  const lastClose = ctx.closes.at(-2);
  if (lastClose == null) return null;

  if (pos > 0) {
    if (lastClose < ema200) return { side: 'sell', qty: pos };
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: '200d avg break' },
      { side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return null;
  }

  if (lastClose > ema200) {
    const risk = 0.02 * ctx.cash;
    const stopDist = 2 * atr;
    const qty = risk / stopDist;
    if (qty <= 0) return null;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: '200d avg break' },
      { side: 'sell', price: px - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: '200d avg' }]);
  return null;
}
