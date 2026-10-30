/*
 * @coinsori-strategy v1
 * name: ETH Trend Strength + Slope Exit + Wide Trail 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: the slope-gated 200-SMA exit improved all three windows (2019-21 +741%,
 * 2021-23 +26%, 2023-25 +48%) but MDD hit 65% in the bull because it holds
 * through pullbacks until the SMA turns. Adding a wide 45% trailing stop from
 * the peak cuts only the deepest crashes (May-2021 style), not the 30-40%
 * bounces inside a bear market.
 * When it buys and sells: long on a close above the 200-SMA, sized by
 * risk/ATR. Sells on a close below the 200-SMA while it is falling, or 45%
 * below the peak since entry, or a hard 20% stop below entry.
 * When it does NOT work: in a choppy flat market the slope gate filters
 * nothing and it whipsaws; at the very top of a bull the SMA is still rising,
 * so it holds through the first leg of a crash.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const smaPrev = ctx.sma(200, 50);
  const c1 = ctx.closes.at(-2), c2 = ctx.closes.at(-3);
  if (sma == null || smaP == null || smaPrev == null || c1 == null || c2 == null) return null;
  const price = ctx.price, pos = ctx.position;

  if (pos > 0) {
    let peak = ctx.state.peak;
    if (peak == null || price > peak) peak = price;
    ctx.state.peak = peak;
    const trail = peak * 0.55; // 45% below peak
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.80 : null;
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'close<200d avg & slope down' },
      { side: 'sell', price: trail, trigger: 'below', note: '45% trailing stop' },
      { side: 'sell', price: stop, trigger: 'below', note: '20% hard stop' }
    ]);
    if (c1 < sma && sma < smaPrev) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= trail) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  ctx.state.peak = null;
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'cross above 200d avg' }]);
  if (c2 <= smaP && c1 > sma) {
    const atr = ctx.atr(14, 1);
    if (atr == null || atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
    const distPct = (c1 - sma) / sma;
    const risk = 300 + Math.min(Math.max(distPct * 20000, 0), 1200);
    const qty = Math.min(risk / atr, (ctx.cash / price) * 0.98);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
