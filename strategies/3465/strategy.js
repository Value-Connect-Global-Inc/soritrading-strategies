/*
 * @coinsori-strategy v1
 * name: Miner Commitment Long BTC 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's long-term value is anchored by network fundamentals. When miners keep adding hashrate (their money is committed to the network) and price is above its long-term average, the market is in a healthy uptrend worth riding long.
 * When it buys and sells: buys when hashrate has been above its 30-day average for 3 straight days AND price is above the 200-day average. Sells when price falls 5% below the 200-day average, when hashrate has been below its trend for 3 straight days, or on a -12% hard stop.
 * When it does NOT work: in long sideways markets where price oscillates around the 200-day average it whipsaws; the slow gate also rides drawdowns longer than a fast momentum system would.
 */

function onUpdate(ctx) {
  const st = ctx.state;
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (hr == null || hrSma == null || hrSma <= 0) return null; // data unknown -> do nothing
  const hrUp = hr > hrSma;
  st.hrDays = hrUp ? (st.hrDays || 0) + 1 : 0;        // consecutive hashrate-up days
  st.hrDownDays = hrUp ? 0 : (st.hrDownDays || 0) + 1;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position <= 0) {
    if (st.hrDays >= 3 && prevClose > sma200) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
    }
    return null;
  }

  if (prevClose < sma200 * 0.95 || st.hrDownDays >= 3) {
    return { side: 'sell', qty: ctx.position };
  }
  if (ctx.entryPx != null && prevClose < ctx.entryPx * 0.88) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
