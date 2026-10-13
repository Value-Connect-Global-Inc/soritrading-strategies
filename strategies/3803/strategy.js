/*
 * @coinsori-strategy v1
 * name: OnChainNetworkTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: Bitcoin's price tends to follow its real network usage. When active addresses
 * are growing and the long-term trend is up, price usually keeps climbing.
 * When it buys and sells: Buys when price is above its 200-day average, that average is rising, and
 * active addresses are above their 30-day average. Sells when price drops below its 50-day average,
 * the trend flattens, or network usage stops growing. A hard 10% stop protects every position.
 * When it does NOT work: In long sideways chop the 200-day trend is flat and the address filter
 * whipsaws. It is slow (daily) and single-market, so it misses intraday moves and altcoin runs.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  const sma200p = ctx.sma(200, 2);
  const sma50 = ctx.sma(50, 1);
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (sma200 == null || sma200p == null || sma50 == null || addr == null || addrSma == null) return null;

  const trendUp = sma200 > sma200p;          // long-term trend rising
  const networkGrowing = addr > addrSma;     // on-chain usage expanding vs its own 30d average
  const aboveTrend = price > sma200;

  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.90 : null; // 10% hard stop: daily swings can be large, 10% avoids noise stops
  ctx.watch([
    { side:'buy', price: sma200, trigger:'above', note:'price>200d trend', conds:[
      { label:'200d trend rising', ok: trendUp },
      { label:'addresses>30d avg', ok: networkGrowing } ] },
    { side:'sell', price: sma50, trigger:'below', note:'exit below 50d' },
    { side:'sell', price: stopPx, trigger:'below', note:'hard stop 10%' }
  ]);

  if (ctx.position === 0) {
    if (aboveTrend && trendUp && networkGrowing) {
      return { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
    return null;
  }

  const exit = (price < sma50) || !trendUp || !networkGrowing || (stopPx != null && price <= stopPx);
  if (exit) return { side: 'sell', qty: ctx.position };
  return null;
}
