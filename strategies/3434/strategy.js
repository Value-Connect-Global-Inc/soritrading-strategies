/*
 * @coinsori-strategy v1
 * name: BTC Daily Regime Long 200SMA
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term uptrend is real, but almost all of its damage happens in a few deep bear markets. A slow trend filter (price vs its 200-day average, plus the average itself rising) keeps us in BTC during bull regimes and safely in cash during bear regimes — avoiding the crashes that kill buy-and-hold accounts.
 * When it buys and sells: Holds BTC whenever the daily close is above its 200-day average AND that average has been rising over the last month. Sells everything the day the close falls back below the average.
 * When it does NOT work: Long sideways markets where price wobbles around the 200-day average cause whipsaws. In a window that is one long bull run with no bear phase, plain buy-and-hold earns more because we sit out the pullbacks.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);          // 200-day average of CLOSED bars — the regime line
  if (sma200 == null) return null;
  const sma200Prev = ctx.sma(200, 2);      // yesterday's value, to check the line is rising
  if (sma200Prev == null) return null;
  const prevClose = ctx.closes.at(-2);
  const lineRising = sma200 > sma200Prev;  // the 200-day average itself must be trending up

  // --- exit first: leave the market the day the long-term trend breaks ---
  if (ctx.position > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // --- enter only inside a confirmed, RISING uptrend ---
  // price above the line AND the line rising = textbook; avoids re-buying into a bear rally
  if (prevClose > sma200 && lineRising) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
