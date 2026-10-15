/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian ETH 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed index is a well-documented sentiment
 * gauge. Extreme greed marks crowded long positioning (late buyers), extreme
 * fear marks capitulation. Betting AGAINST the crowd at the extremes — buy
 * panic, take profit into greed — is the classic contrarian edge, on a
 * high-beta asset (ETH) where sentiment swings move price hardest.
 * When it buys and sells: buys (full size) when Fear & Greed drops to <= 15
 * (extreme fear / capitulation), sells when it reaches >= 75 (extreme greed /
 * crowded longs) or price drops 20% from entry (hard stop).
 * When it does NOT work: in a persistent bull, extreme-fear dips are rare and
 * brief, so it sits in cash most of the time and misses the trend; in a slow
 * grind lower, fear can stay low for months and it keeps catching falling
 * knives. It also only has data from Feb 2018.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  // F&G data starts Feb 2018; null = unknown, do not trade on missing data.
  if (fg == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 20% hard stop: caps any single position's loss before the slow daily
      // sentiment index can confirm the regime has flipped.
      const stopPx = entry * 0.80;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: -20%' }]);
    }
    // Take profit into greed: crowded longs are the contrarian sell signal.
    if (fg >= 75) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', note: 'exit: F&G >= 75',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 75, closed: true }] }]);
    return null;
  }

  // Buy capitulation: extreme fear = forced sellers done, low downside.
  if (fg <= 15) {
    ctx.watch([{ side: 'buy', note: 'enter: F&G <= 15',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 15, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash * 0.95) / price };
  }
  ctx.watch([{ side: 'buy', note: 'enter: F&G <= 15',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 15, closed: true }] }]);
  return null;
}
