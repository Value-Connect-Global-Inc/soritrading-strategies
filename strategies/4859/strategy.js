/*
 * @coinsori-strategy v1
 * name: OnChainTrendBtc1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin active addresses measure real on-chain usage; sustained growth in usage tends to accompany price uptrends, and usage collapses mark cycle tops.
 * When it buys and sells: buys when the 30-day average of active addresses is above raw daily addresses (usage expanding); sells when usage rolls over (raw below the 30-day average).
 * When it does NOT work: in chop where on-chain usage wiggles around its average it whipsaws; on-chain data is daily and slow, so it can lag sharp price moves by days.
 */
function onUpdate(ctx) {
  const addr = ctx.data("addr");
  const sma30 = ctx.data("addr_sma30");
  if (addr == null || sma30 == null) return null;

  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;

  // usage expanding → hold; rolling over → exit
  if (pos > 0) {
    if (addr < sma30) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // flat: enter only when usage is expanding
  if (addr > sma30) {
    return { side: 'buy', qty: cash / price * 0.99 };
  }
  return null;
}
