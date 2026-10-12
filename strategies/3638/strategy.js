/*
 * @coinsori-strategy v1
 * name: SimpleTrendDaily
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: long-term uptrends in BTC persist for months once both the
 * 200-day and 50-day averages point up. Riding those confirmed trends with a clear
 * momentum exit is a simple, robust edge that needs no clever filters.
 * When it buys and sells: buys when price is above both the 200-day and 50-day
 * averages (confirmed uptrend). Sells when price closes below the 50-day average
 * (momentum broken).
 * When it does NOT work: choppy sideways markets whipsaw it (buy high, sell low
 * repeatedly), and long bear markets where it stays in cash and misses the bottom.
 */
function onUpdate(ctx) {
  const s200 = ctx.sma(200, 1);
  const s50 = ctx.sma(50, 1);
  if (s200 == null || s50 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    // Entry: confirmed uptrend (200d + 50d both below price).
    if (prevClose > s200 && prevClose > s50) {
      ctx.watch([
        { side: 'sell', price: s50, trigger: 'below', note: 'momentum break' },
        { side: 'sell', price: price * 1.5, trigger: 'above', note: 'profit target' }
      ]);
      // Half the cash per trade so a bad stretch cannot ruin the account.
      return { side: 'buy', qty: (ctx.cash * 0.5) / price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'trend entry', conds: [
      { label: 'Close > SMA200', ok: prevClose > s200, closed: true },
      { label: 'Close > SMA50', ok: prevClose > s50, closed: true }
    ] }]);
    return null;
  }

  // Exit: momentum broken below the 50-day average.
  if (prevClose < s50) {
    ctx.watch([]);
    return { side: 'sell', qty: ctx.position };
  }
  ctx.watch([
    { side: 'sell', price: s50, trigger: 'below', note: 'momentum break' },
    { side: 'sell', price: ctx.entryPx * 1.5, trigger: 'above', note: 'profit target' }
  ]);
  return null;
}
