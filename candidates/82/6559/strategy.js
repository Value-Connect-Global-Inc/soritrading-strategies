/*
 * @coinsori-strategy v1
 * name: BTC Spot Regime Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC moves in long multi-month trends. A slow 200-bar (about 33 days) SMA
 * separates bull regimes from bear regimes. This spot version only goes long above the SMA and
 * steps fully to cash below it, so it rides up-trends but avoids most of the bear-market damage —
 * the goal is a return close to buy-and-hold with a much smaller drawdown.
 * When it buys and sells: When the last closed 4h bar closes more than 2% above a RISING SMA200,
 * buy BTC with the whole account. When it closes more than 2% below the SMA, sell everything and
 * stay in cash. Between the two lines, hold what you have. A volatility-based stop closes any
 * position that falls 3x the current 14-bar ATR from its entry price.
 * When it does NOT work: In a long flat sideways range the price crosses the band edges repeatedly
 * and each crossing costs fees (whipsaw). It lags sharp V-shaped recoveries — it re-enters only
 * after the price climbs back above the SMA, missing the initial bounce. In a relentless straight-up
 * bull market it is in cash during pullbacks and so underperforms buy-and-hold.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility-based hard stop: 3x the 14-bar ATR from entry, so it only fires in genuine fast
  // crashes, not normal pullbacks (a fixed 8% fired too often in choppy bear regimes)
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma200 * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' }]);
    if (prevClose < sma200 * (1 - band)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat: only buy when the trend is clearly up AND the SMA is still rising — this keeps us out
  // of dead-cat bounces in a declining regime, which caused most of the whipsaw losses
  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma200 > smaPrev;

  ctx.watch([{ side: 'buy', price: sma200 * (1 + band), trigger: 'above', note: 'SMA200 +2% go long' }]);
  if (rising && prevClose > sma200 * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
