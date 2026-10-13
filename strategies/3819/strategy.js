/*
 * @coinsori-strategy v1
 * name: BtcAddrAdoption
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's value comes from people using the network. When daily
 * active addresses drop below their 30-day average (adoption capitulation) and then
 * recover, it marks a demand bottom; buying that recovery in a healthy long-term trend
 * has historically rewarded patience.
 * When it buys and sells: Buys when active addresses recover above their 30-day average
 * within 60 days of a dip below it, while price is above its 200-day average. Sells on a
 * 2x ATR trailing stop, when price breaks its 50-day average, or when adoption dips again.
 * When it does NOT work: active addresses are noisy and can fall even as price rises
 * (exchange-driven volume, bots). In a long bear market the 200-day filter keeps it in
 * cash and it misses the decline. Long only, so no profit from falling markets.
 */

function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (addr == null || addrSma == null || sma200 == null || sma50 == null) return null;

  const ratio = addr / addrSma;
  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  // remember the most recent bar where adoption dipped below its 30-day average
  if (ratio < 0.97) st.lastDip = ctx.i;

  if (pos === 0) {
    // entry: adoption recovered within 60 days of a dip, long-term trend healthy
    const recentDip = st.lastDip != null && (ctx.i - st.lastDip) <= 60;
    if (recentDip && ratio > 0.99 && price > sma200) {
      const atr = ctx.atr(14, 1);
      if (atr == null) return null;
      st.hi = price;
      // risk 4% of the account on a 2x ATR stop
      const qty = (ctx.cash * 0.04) / (2 * atr);
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  // exit 1: adoption dips again while we hold, or price breaks its 50-day average
  if (ratio < 0.97 || price < sma50) return { side: 'sell', qty: pos };

  // exit 2: trailing stop on the highest close since entry
  if (price > st.hi) st.hi = price;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopPx = st.hi - 2 * atr;
  ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '2x ATR trailing stop' }]);
  if (price <= stopPx) return { side: 'sell', qty: pos };
  return null;
}
