/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Extreme crowd fear (Fear & Greed index below 20) historically marks good long entries for Bitcoin, while extreme greed marks profit-taking, as long as the longer trend is intact.
 * When it buys and sells: Buys when the daily Fear & Greed index drops below 20 while price is above its 200-day average (uptrend intact). Sells when the index rises above 65, when price falls below its 50-day average, or on a hard 10% stop-loss from entry.
 * When it does NOT work: In a sustained bear market price stays below the 200-day average so it mostly stays out, but sharp crashes can still hit the 10% stop. Flat choppy ranges give small whipsaw losses.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fg');
  if (fg == null) return null; // sentiment dataset missing

  const sma50 = ctx.sma(50, 1);  // closed-bar trend exit line
  const sma200 = ctx.sma(200, 1); // closed-bar regime filter
  if (sma50 == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stop = entry * 0.90; // hard 10% stop — cannot ruin account on one trade
    const exitGreed = fg > 65;  // crowd greedy -> take profit (asymmetric: enter at 20, exit at 65)
    const exitTrend = price < sma50; // trend broke
    if (exitGreed || exitTrend || price < stop) {
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' },
      { side: 'sell', price: null, note: 'fg>65' }
    ]);
    return null;
  }

  // entry: extreme fear + uptrend intact
  if (fg < 20 && price > sma200) {
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  // no concrete price level to wait on (sentiment signal) -> no watch when flat
  return null;
}
