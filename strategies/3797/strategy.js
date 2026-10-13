/*
 * @coinsori-strategy v1
 * name: OnChain Pulse
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's on-chain network usage (daily active addresses) is a
 * health signal that tends to lead price. We only buy when the network is actually
 * growing, and we ride the position while the long-term price trend stays up.
 * When it buys and sells: Buy when price is above its 200-day average AND daily
 * active addresses are above their 30-day average (network expanding). Sell when
 * price falls back below its 200-day average, or on a 25% hard stop below entry.
 * When it does NOT work: In a long bear market price stays under the 200-day average
 * so the strategy sits in cash (no loss, but no gain either). It also lags sharp
 * recoveries because it waits for BOTH price and network confirmation before buying.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  const addr = ctx.data('addr');
  const addrS = ctx.data('addr_sma30');
  if (sma200 == null || addr == null || addrS == null) return null;

  const trendUp = prevClose > sma200;      // long-term uptrend intact
  const netUp = addr > addrS;              // network expanding vs its 30-day mean

  ctx.watch([
    { side:'buy', price: sma200, trigger:'above', note:'SMA200 break up',
      conds:[{ label:'network expanding', ok: netUp }] },
    { side:'sell', price: sma200, trigger:'below', note:'SMA200 break down' }
  ]);

  const pos = ctx.position || 0;

  if (pos === 0) {
    // only enter with both trend AND network confirmation
    if (trendUp && netUp) {
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
