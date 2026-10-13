/*
 * @coinsori-strategy v1
 * name: FearGreed Bull Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Retail sentiment (Fear & Greed index) swings to fear at local bottoms and greed at local tops. Buying fear in a confirmed long-term bull market (price above its 200-day average) and selling greed captures the best risk/reward.
 * When it buys and sells: Buys when the Fear & Greed index is fearful (below 40) AND price is above its 200-day average (bull regime). Sells when the index turns greedy (above 60) or price falls below the 200-day average (bull broken).
 * When it does NOT work: In a prolonged bear market price stays below the 200-day average so it stays in cash (misses the eventual bottom) — this is a bull-market-only strategy. In choppy sideways markets where the index oscillates around 40-60 it trades little and may sit flat for long stretches.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200);
  if (fg == null || sma200 == null) return null;

  const inBull = ctx.price > sma200;
  const fearful = fg < 40;
  const greedy = fg > 60;

  // Only trade a confirmed bull regime: price must be above the 200d average.
  // Fearful = buy the dip; greedy = take profit. Exit bull too if the trend breaks.
  if (ctx.position <= 0 && inBull && fearful) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position > 0 && (greedy || !inBull)) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
