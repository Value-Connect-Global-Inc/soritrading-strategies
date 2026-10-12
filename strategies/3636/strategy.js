/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto crowds are wrong at extremes — the Fear & Greed index
 * measures crowd emotion, and buying fear while the long-term trend is still up
 * has historically given good risk/reward.
 * When it buys and sells: buys when Fear & Greed <= 40 AND price is above the 200-day
 * average (fear dip in an uptrend). Sells when Fear & Greed >= 65 (greed), or when the
 * price falls 30% from its highest point since entry (trailing stop that lets winners run).
 * When it does NOT work: long bear markets where price stays below the 200-day average
 * (it stays in cash and misses the rebound), and choppy sideways markets where fear
 * dips don't recover.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const s = ctx.sma(200, 1);
  if (fg == null || s == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    // Entry: fear + uptrend intact.
    if (fg <= 40 && prevClose > s) {
      ctx.watch([
        { side: 'sell', price: price * 0.7, trigger: 'below', note: 'trailing stop' },
        { side: 'sell', price: price * 1.5, trigger: 'above', note: 'greed target' }
      ]);
      return { side: 'buy', qty: (ctx.cash * 0.5) / price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'fear entry', conds: [
      { label: 'Fear-Greed', now: fg, op: '<=', ref: 40, closed: true },
      { label: 'Close > SMA200', ok: prevClose > s, closed: true }
    ] }]);
    return null;
  }

  // Rolling peak of the last 30 closes (approx. trailing high since entry).
  const peak = Math.max(ctx.entryPx, ...ctx.closes.slice(-30));
  const trail = peak * 0.7;
  // Exit on greed or when price trails 30% off its post-entry peak.
  if (fg >= 65 || prevClose < trail) {
    ctx.watch([]);
    return { side: 'sell', qty: ctx.position };
  }
  ctx.watch([
    { side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' },
    { side: 'sell', price: ctx.entryPx * 1.5, trigger: 'above', note: 'greed target' }
  ]);
  return null;
}
