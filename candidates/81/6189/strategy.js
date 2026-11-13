/*
 * @coinsori-strategy v1
 * name: BTC 1H Slow Trend + Vol-Targeted Size
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: A very slow 200h/600h EMA trend filter rides Bitcoin's major up-trends
 * with few signals, and a crash acceleration stop cuts violent drops. Two risk controls keep
 * the whipsaw bleed small: the 200-EMA must be rising to enter (no buying bounces in a
 * falling average), and the position is volatility-targeted (full in calm trends, scaled down
 * in volatile ones).
 * When it buys and sells: Buy (sized by calmness) when the 200-EMA is above the 600-EMA, the
 * 200-EMA is rising, and price closes above the 200-EMA. Sell everything when the 200-EMA
 * crosses below the 600-EMA, when price closes 10% below the 200-EMA (violent crash), or on
 * a -25% disaster stop.
 * When it does NOT work: In a long flat chop the slow cross still whipsaws and pays fees; a
 * violent gap-down can jump through every stop so the disaster stop becomes the real exit.
 * It lags a straight-line melt-up because it is flat between trades and pays fees on each
 * re-entry.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const ema200_5 = ctx.ema(200, 5);
  const ema600 = ctx.ema(600, 1);
  const atr100 = ctx.atr(100, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema200 == null || ema200_5 == null || ema600 == null || atr100 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const uptrend = ema200 > ema600;
  const emaRising = ema200 > ema200_5;

  if (ctx.position > 0) {
    // Acceleration stop: price 10% below the 8-day average = violent crash, exit now.
    const accel = ema200 * 0.90;
    const disaster = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend death EMA200<EMA600', conds: [{ label: 'EMA200<EMA600', ok: ema200 < ema600 }] },
      { side: 'sell', price: accel, trigger: 'below', note: 'crash accel 10% below 200EMA' },
      ...(disaster != null ? [{ side: 'sell', price: disaster, trigger: 'below', note: 'disaster -25%' }] : [])
    ]);
    if (disaster != null && prevClose < disaster) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (ema200 < ema600) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < accel) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  // Entry requires the 8-day average to be rising: never buy a bounce in a falling trend.
  if (uptrend && emaRising && prevClose > ema200) {
    // Volatility-targeted size: full position when 1h ATR(100) is calm (~0.5% of price),
    // scaled down as volatility rises so whipsaw losses stay small in choppy markets.
    const volPct = (atr100 / prevClose) * 100;
    const sizeFactor = Math.max(0.15, Math.min(1.0, 0.5 / volPct));
    ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'rising uptrend + above 200EMA', conds: [{ label: 'EMA200>EMA600', ok: true }, { label: 'EMA200 rising', ok: true }] }]);
    const qty = ((ctx.cash * sizeFactor) / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'waiting rising uptrend', conds: [{ label: 'EMA200>EMA600', ok: uptrend }, { label: 'EMA200 rising', ok: emaRising }] }]);
  return null;
}
