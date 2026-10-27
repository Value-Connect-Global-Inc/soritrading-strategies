/*
 * @coinsori-strategy v1
 * name: BTC OBV OnChain-Gated 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The OBV money-flow trend was the strongest validated BTC idea
 * in this job's ledger (+707% W2, +131% W3, beating buy-and-hold ~2x). This version
 * adds a genuinely different confirmation: on-chain active addresses. When network
 * usage is growing (addresses above their 30-day average) the trend is backed by
 * real adoption, not just speculation — so entries during rising usage should be
 * more reliable and exits later.
 * When it buys and sells: Buys when the 45-day OBV is rising, price is above the
 * 200d SMA AND daily active addresses are above their 30-day average. Sells when
 * the 45-day OBV turns down or price closes below the 200d SMA.
 * When it does NOT work: Same whipsaw as any trend follower in sideways markets;
 * and if addresses stay flat for long stretches the gate adds nothing but delay.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  // Closed-bar indicators so backtest/paper/live behave identically.
  const obv = ctx.obv(45, 1);
  const obvPrev = ctx.obv(45, 2);
  const sma200 = ctx.sma(200, 1);
  const addr = ctx.data("addr"); // daily active addresses, null until first value
  const addrAvg = ctx.data("addr_sma30"); // 30d average of active addresses
  if (obv == null || obvPrev == null || sma200 == null) return null;

  const prevClose = closes.at(-2);

  if (pos != null && pos > 0) {
    // Exit when money-flow turns down or the long-term trend breaks.
    const obvDown = obv < obvPrev;
    const trendBroken = prevClose < sma200;
    if (obvDown || trendBroken) {
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend break' },
                 { side: 'sell', note: 'OBV down' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: OBV rising + price above 200d + on-chain usage rising.
  const obvUp = obv > obvPrev;
  if (obvUp && prevClose > sma200 && addr != null && addrAvg != null && addr > addrAvg) {
    if (ctx.alloc.status !== 'ok') return null;
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'OBV up, addr rising',
                 conds: [{ label: 'addr>30d avg', ok: addr > addrAvg, closed: true }] }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
