/*
 * @coinsori-strategy v1
 * name: ETH Chandelier Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a trending market the highest high keeps rising; a chandelier stop hangs
 * 3×ATR below that high and rides the trend while it lives, then exits when price pulls back more
 * than normal volatility. ATR makes the stop adapt to how choppy ETH is right now.
 * When it buys and sells: Buys when price rises above the 50-period high (new short-term high).
 * Sells when price closes 3×ATR(14) below the highest high since entry, or on a 25% stop.
 * When it does NOT work: In a sideways range it keeps getting stopped out just above the entry
 * (whipsaw) — the 3×ATR buffer helps but ranges still cost money. Fees on 4h bars add up.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const hi50 = ctx.high(50, 1); // highest high over the last 50 CLOSED bars
  if (atr == null || hi50 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, ctx.highs.at(-2)) : ctx.highs.at(-2);
    ctx.state.peak = peak;
    const trail = peak - 3 * atr;
    const stop = (ctx.entryPx != null) ? ctx.entryPx * 0.75 : null; // 25% disaster stop
    ctx.watch([
      { side: 'sell', price: trail, trigger: 'below', note: 'ATR chandelier stop' },
      { side: 'sell', price: stop, trigger: 'below', note: '25% stop' }
    ]);
    if (prevClose < trail) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: hi50, trigger: 'above', note: '50-bar high breakout' }
  ]);
  if (ctx.price > hi50) {
    // 60% of cash; trailing stop keeps risk bounded
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
