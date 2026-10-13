/*
 * @coinsori-strategy v1
 * name: OnChain Pulse v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin on-chain usage (daily active addresses) is a slow
 * network-health signal. The v1 test showed raw daily addresses spike at price
 * tops, so this version only enters on a STRONG network expansion (5% above the
 * 30-day mean) together with an intact long-term price trend, and exits only on
 * a trend break — no noisy intraday churn.
 * When it buys and sells: Buy when price is above its 200-day average AND daily
 * active addresses are at least 5% above their 30-day average. Sell when price
 * falls back below its 200-day average, or on a 25% hard stop.
 * When it does NOT work: In a long bear market price stays under the 200-day
 * average and the strategy sits in cash. It also lags sharp recoveries because
 * it waits for BOTH price and network confirmation, and the strong-expansion
 * gate makes it miss early-stage rallies.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  const addr = ctx.data('addr');
  const addrS = ctx.data('addr_sma30');
  if (sma200 == null || addr == null || addrS == null) return null;

  // 5% above the 30-day mean = clear network expansion, not a daily noise spike
  const netStrong = addr > addrS * 1.05;
  const trendUp = prevClose > sma200;

  ctx.watch([
    { side:'buy', price: sma200, trigger:'above', note:'SMA200 break up',
      conds:[{ label:'network +5% vs 30d', ok: netStrong }] },
    { side:'sell', price: sma200, trigger:'below', note:'SMA200 break down' }
  ]);

  const pos = ctx.position || 0;

  if (pos === 0) {
    if (trendUp && netStrong) {
      return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    return null;
  }

  // hard stop: 25% below entry caps tail risk on a long-only daily strategy
  if (ctx.entryPx != null && ctx.price < ctx.entryPx * 0.75) {
    return { side:'sell', qty: pos };
  }
  if (prevClose < sma200) {
    return { side:'sell', qty: pos };
  }
  return null;
}
