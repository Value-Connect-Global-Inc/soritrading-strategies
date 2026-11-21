/*
 * @coinsori-strategy v1
 * name: BTC 4H Funding Sentiment Contrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Perpetual funding rate is a crowd-positioning gauge.
 * Very negative funding means shorts are crowded and paying longs — a
 * contrarian long opportunity; very positive means longs are crowded — a
 * contrarian short opportunity.
 * When it buys and sells: go long when funding is very negative, go short
 * when funding is very positive, and close back to flat when funding
 * reverts to neutral. A hard stop caps the worst case.
 * When it does NOT work: during strong directional trends the crowd can stay
 * one-sided for a long time (crowded longs keep making money in a rally),
 * so the contrarian bet fights the trend. The stop limits this.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const funding = ctx.funding;
  if (funding == null) return null;

  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.5;

  // Funding thresholds: 0.0005 = 0.05% per funding interval, extreme for BTC.
  const LONG_BELOW = -0.0005;
  const SHORT_ABOVE = 0.0005;
  const NEUTRAL = 0.0001;

  if (ctx.position === 0) {
    if (funding <= LONG_BELOW) {
      ctx.watch([{ side:'buy', at: Math.floor(Date.now()/1000)+1, note:'funding very negative' }]);
      return { side:'buy', qty: qty };
    }
    if (funding >= SHORT_ABOVE) {
      ctx.watch([{ side:'sell', at: Math.floor(Date.now()/1000)+1, note:'funding very positive' }]);
      return { side:'sell', qty: qty };
    }
    return null;
  }

  // Exit when funding reverts to neutral, or hard stop.
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.95 : null;
  ctx.watch([
    { side:'sell', at: Math.floor(Date.now()/1000)+1, note:'funding neutral' },
    { side:'sell', price: stop, trigger:'below', note:'hard stop' }
  ]);
  const dir = ctx.position > 0 ? 1 : -1;
  if (dir > 0 && funding >= NEUTRAL) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (dir < 0 && funding <= -NEUTRAL) return { side:'buy', qty: -ctx.position, reduceOnly: true };
  if (stop != null && dir > 0 && price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (stop != null && dir < 0 && price >= ctx.entryPx * 1.05) return { side:'buy', qty: -ctx.position, reduceOnly: true };
  return null;
}
