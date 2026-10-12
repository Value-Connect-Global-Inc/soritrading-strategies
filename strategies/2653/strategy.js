/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion DOGE 4H
 * ex: binance
 * syms: DOGEUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Mean-reversion family. When price touches the lower
 * Bollinger band with RSI oversold, it is a panic sell-off that tends to
 * bounce back to the middle band. This exact recipe has held up on 10 assets
 * (SOL/ATOM/UNI/LINK/AVAX/ADA/BNB/DOT/XRP/LTC) with low drawdown. Extending
 * it to DOGE, a high-volume large-cap that mean-reverts around its bands.
 * When it buys and sells: buys when price closes at/below the lower band with
 * RSI below 35; sells when price reaches the middle band or RSI turns above 65.
 * When it does NOT work: in strong trending rallies where price hugs the outer
 * band for long stretches it stays in cash and misses the move; and it can
 * catch falling knives in persistent downtrends. Defensive, not a bull-chaser.
 *
 * 2025-04-08: display-only change — added ctx.watch declarations, trading logic untouched.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const rsiPrev = ctx.rsi(14, 2);
  if (bb == null || rsi == null || rsiPrev == null) return null;

  const px = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    // Exit: price back at the middle band, or RSI turning overbought.
    const exitMid = px >= bb.mid;
    const exitRsi = rsi > 65 && rsiPrev <= 65;
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', qty: pos, note: 'middle band target' },
      { side: 'sell', price: 65, trigger: 'above', qty: pos, note: 'RSI overbought', conds: [{ label: 'RSI(14) prev', now: rsiPrev, op: '<=', ref: 65, closed: true }, { label: 'RSI(14) now', now: rsi, op: '>', ref: 65, closed: true }] }
    ]);
    if (exitMid || exitRsi) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry: panic sell-off — price at/below the lower band with RSI oversold.
  const entryPx = px <= bb.lower;
  const entryRsi = rsi < 35;
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', qty: ctx.cash / ctx.price * 0.95, note: 'lower band touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true }] }
  ]);
  if (entryPx && entryRsi) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
