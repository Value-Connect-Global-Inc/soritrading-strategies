/*
 * @coinsori-strategy v1
 * name: ETH 4H Slow Trend Ride
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto has long persistent up-trends (melt-ups) that
 * mean-reversion strategies systematically miss because they sell into strength.
 * This strategy rides confirmed up-trends instead of fading them, aiming to
 * capture the upside the defensive strategies give up.
 * When it buys and sells: it buys while price is above the 200-bar average (a
 * long-term uptrend) once the 50-bar average turns up above the 200-bar line.
 * It sells when price closes back below the 200-bar average (the trend broke).
 * When it does NOT work: in choppy sideways markets the 200-bar line is crossed
 * repeatedly and it whipsaws, and in a crash it only exits after price falls
 * back below the 200-bar average, giving back a chunk of the drop.
 *
 * 2024-01-01: Added ctx.watch declarations only — display changes, trading logic unchanged.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (ema50 == null || ema200 == null || px == null) return null;

  // Exit when the long-term trend breaks (price closes below the 200-bar line).
  if (ctx.position > 0 && px < ema200) {
    ctx.watch([{ side: 'sell', price: ema200, trigger: 'below', note: 'trend break exit' }]);
    return { side: 'sell', qty: ctx.position };
  }

  // Enter on a confirmed uptrend: price above 200-bar line and 50-bar average
  // above it (trend aligned). Size a fixed fraction of equity.
  if (ctx.position === 0) {
    const ema50Prev = ctx.ema(50, 2);
    const ema200Prev = ctx.ema(200, 2);
    if (ema50Prev == null || ema200Prev == null) return null;
    // require the 50-bar average to be rising (above its own previous value)
    // and price above the long-term line — a slow, confirmed uptrend.
    if (px > ema200 && ema50 > ema200 && ema50 > ema50Prev) {
      const qty = (ctx.cash / ctx.price) * 0.99;
      ctx.watch([{ side: 'sell', price: ema200, trigger: 'below', note: 'trend break exit' }]);
      return { side: 'buy', qty: qty };
    }
    ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'entry: px>ema200 & ema50>ema200 & rising', conds: [
      { label: 'EMA50 > EMA200', now: ema50, op: '>', ref: ema200, closed: true },
      { label: 'EMA50 rising', now: ema50, op: '>', ref: ema50Prev, closed: true }
    ]}]);
  } else {
    ctx.watch([{ side: 'sell', price: ema200, trigger: 'below', note: 'trend break exit' }]);
  }
  return null;
}
