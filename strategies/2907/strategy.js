/*
 * @coinsori-strategy v1
 * name: ETH 4H Slow Trend Ride
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Crypto has long persistent up-trends (melt-ups) that
 * mean-reversion strategies systematically miss because they sell into strength.
 * This strategy rides confirmed up-trends instead of fading them, aiming to
 * capture the upside the defensive strategies give up.
 * When it buys and sells: it buys when the slow 60-bar average climbs above the
 * 200-bar average (a confirmed uptrend) while price is above the 200-bar line.
 * It sells when price falls below a volatility-based trailing stop, or when the
 * trend itself turns down (60-bar average drops below the 200-bar average).
 * When it does NOT work: in choppy sideways markets the trend is false and it
 * whipsaws in and out, paying fees without progress. It also gives back part of
 * every crash because it only reacts after price falls through the trailing stop.
 */
function onUpdate(ctx) {
  const fast = ctx.ema(60, 1);
  const slow = ctx.ema(200, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  const atr = ctx.atr(14, 1);
  if (fast == null || slow == null || atr == null || px == null) {
    ctx.watch([]);
    return null;
  }

  // ATR-scaled position: risk a fixed fraction of equity per trade, smaller
  // size when volatility is high so a single stop-out is cheap.
  const equity = ctx.cash + ctx.position * ctx.price;
  const riskPerTrade = 0.01; // risk 1% of equity on a stop loss
  const stopDist = 2 * atr; // stop is 2 ATR below entry
  const qty = Math.max(0, Math.min(equity * riskPerTrade / stopDist, (ctx.cash / ctx.price) * 0.99));

  // Exit: volatility trailing stop, or trend rollover.
  if (ctx.position > 0) {
    const trailStop = ctx.price - 2 * atr;
    const entry = ctx.entryPx || 0;
    const stop = Math.max(entry - 2 * atr, trailStop); // ratchet the stop up
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'volatility stop' },
      { side: 'sell', note: 'trend rollover', conds: [{ label: 'fast EMA < slow EMA', ok: fast < slow }] }
    ]);
    if (px < stop || fast < slow) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // Enter only on a confirmed uptrend with a fresh golden cross (slow, avoids
  // the whipsaw that kills fast crossovers in crypto).
  const fastPrev = ctx.ema(60, 2);
  const slowPrev = ctx.ema(200, 2);
  if (fastPrev == null || slowPrev == null) {
    ctx.watch([]);
    return null;
  }
  const crossedUp = fastPrev <= slowPrev && fast > slow;
  ctx.watch([
    {
      side: 'buy',
      price: slow,
      trigger: 'above',
      note: 'price above slow EMA',
      conds: [{ label: 'golden cross', ok: crossedUp }]
    }
  ]);
  if (crossedUp && px > slow && qty > 0) {
    return { side: 'buy', qty: qty };
  }
  return null;
}
