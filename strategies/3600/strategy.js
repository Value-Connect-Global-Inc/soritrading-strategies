/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A different family from both trend-following and mean reversion —
 *   sentiment. The Crypto Fear & Greed index is a market-wide emotion gauge. Bet:
 *   extreme FEAR (index below 20) is when the crowd is capitulating, and BTC tends to
 *   be oversold near such panic; extreme GREED is when the crowd is max long.
 * When it buys and sells: buys when the fear-greed index is below 20 (panic) AND price
 *   is above the 200 SMA (long-term trend still up — don't catch a real bear-market
 *   knife). Sells when the index climbs back above 60 (crowd turned greedy) or on a
 *   hard 2x ATR stop below entry.
 * When it does NOT work: in a genuine bear market the index stays in fear for months
 *   and every "panic" buy keeps falling — the 200 SMA filter is the guard but not a
 *   guarantee. Also the index is daily data, so this is a slow, low-frequency strategy.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');   // 0-100, daily sentiment index; null when unknown
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (fg == null || atr == null || sma200 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (fg >= 60) return { side: 'sell', qty: ctx.position };   // crowd turned greedy, take the contrarian profit
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', at: 0, note: 'fear-greed back above 60' }]);
    return null;
  }

  // entry: panic (index < 20) but only inside an uptrend
  if (fg >= 20) return null;
  if (prevClose <= sma200) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
