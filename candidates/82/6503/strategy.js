/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion RSI 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a ranging market Bitcoin mean-reverts: sharp drops
 * below a short-term band tend to bounce back to the average. This strategy
 * buys oversold bounces and sells overbought tops, the opposite of trend
 * following, so it earns in chop where trend riders bleed.
 * When it buys and sells: Buy when RSI(14) drops below 30 and price closes
 * below the lower Bollinger band (oversold), and sell when RSI rises above
 * 60 or price closes above the middle band (reverted to the mean). A 10%
 * stop-loss caps a falling-knife position.
 * When it does NOT work: In a strong one-way trend the "oversold" buy keeps
 * catching falling knives and the stop-loss repeatedly fires, so it loses
 * exactly when the trend-following strategy wins. It must sit out confirmed
 * trends.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  if (pos > 0) {
    const peak = ctx.state.peak;
    const stop = peak * 0.90; // 10% stop-loss caps a falling-knife position
    const stopHit = prevClose < stop;
    // Exit when RSI recovers above 60 (bounce done) or price re-enters the band.
    const revert = rsi > 60 || prevClose > bb.mid;

    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'reverted to mean' },
      { side: 'sell', price: stop, trigger: 'below', note: 'stop-loss' }
    ]);
    if (revert || stopHit) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  // Oversold: RSI below 30 AND close below the lower Bollinger band.
  const oversold = rsi < 30 && prevClose < bb.lower;
  const buyLevel = bb.lower;

  ctx.watch([{
    side: 'buy', price: buyLevel, trigger: 'below', note: 'oversold bounce',
    conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }
    ]
  }]);
  if (oversold) {
    ctx.state.peak = prevClose;
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
