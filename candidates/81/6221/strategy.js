/*
 * @coinsori-strategy v1
 * name: BTC Turtle Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: classic turtle trend-following on BTC 4h. BTC trends last weeks; an
 * 18-DAY breakout entry rides them while the 20-DAY channel exit steps aside in crashes.
 * When it buys and sells: buys when price breaks the 18-day high AND the 33-day trend is up;
 * sells when price breaks below the 20-day low.
 * When it does NOT work: long sideways chop — breakouts fail and each is a small loss. A slow
 * grind down never triggers a buy, so it sits flat (makes nothing, loses nothing).
 */
function onUpdate(ctx) {
  const ENTRY_N = 110;  // ~18 days at 4h — breakout length (short enough to catch trends early)
  const EXIT_N = 120;   // ~20 days at 4h — patient channel exit
  const TREND_N = 200;  // ~33 days at 4h — long-term trend filter

  // signals use CLOSED bars (ago=1) so live and backtest behave identically
  const entryHigh = ctx.high(ENTRY_N, 1);  // highest high of last 110 closed bars
  const exitLow = ctx.low(EXIT_N, 1);      // lowest low of last 120 closed bars
  const trendEma = ctx.ema(TREND_N, 1);
  if (entryHigh == null || exitLow == null || trendEma == null) { ctx.watch([]); return null; }

  const price = ctx.price;

  if (ctx.position > 0) {
    // exit: price falls below the 20-day low
    if (price < exitLow) {
      ctx.watch([{ side: 'sell', price: exitLow, trigger: 'below', note: '20-day low exit' }]);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: exitLow, trigger: 'below', note: '20-day low exit' }]);
    return null;
  }

  // entry: breakout, but only when the long-term trend is up (avoids buying in downtrends)
  if (price > entryHigh && price > trendEma) {
    ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '18-day breakout + trend up' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '18-day breakout + trend up' }]);
  return null;
}
