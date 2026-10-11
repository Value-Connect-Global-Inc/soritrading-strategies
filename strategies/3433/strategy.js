/*
 * @coinsori-strategy v1
 * name: BTC Daily Regime Long 200SMA
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term uptrend is real, but almost all of its damage happens in a few deep bear markets. A slow trend filter (price vs its 200-day average) keeps us in BTC during bull regimes and safely in cash during bear regimes — avoiding the crashes that kill buy-and-hold accounts.
 * When it buys and sells: Holds BTC whenever the daily close is above its 200-day average (confirmed uptrend). Sells everything the day the close falls back below that average.
 * When it does NOT work: Long sideways markets where price wobbles around the 200-day average cause whipsaws (buy high, sell low, repeat). In a window that is one long bull run with no bear phase, plain buy-and-hold earns more because we sit out the pullbacks.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);          // 200-day average of CLOSED bars — the regime line
  if (sma200 == null) return null;         // need 200 bars before we can judge the regime
  const prevClose = ctx.closes.at(-2);

  // --- exit first: leave the market the day the long-term trend breaks ---
  if (ctx.position > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // --- enter only inside a confirmed uptrend ---
  // 2% buffer above the line avoids re-entering on tiny wiggles right at the boundary (reduces whipsaw)
  if (prevClose > sma200 * 1.02) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
