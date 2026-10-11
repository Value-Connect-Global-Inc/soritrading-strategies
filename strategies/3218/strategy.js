/*
 * @coinsori-strategy v1
 * name: On-Chain Network Growth BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active-address count is a proxy for real network usage;
 * sustained growth in active addresses has historically coincided with price gains.
 * When it buys and sells: it stays LONG while the current active-address count is above
 * its 30-day average (network growing). It sells back to cash when addresses fall below
 * their 30-day average (network contracting).
 * When it does NOT work: in a bull market driven purely by macro liquidity (no new users)
 * addresses can stay flat while price runs — this strategy sits out those rallies. It also
 * lags sharp crashes because address data moves slowly.
 * 2025-04-26: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  if (addr == null || addrAvg == null) {
    ctx.watch([]);
    return null;
  }

  const growing = addr > addrAvg;

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', note: 'addr > sma30', conds: [{ label: 'addr', now: addr, op: '>', ref: addrAvg }] }]);
  } else {
    ctx.watch([{ side: 'sell', note: 'addr < sma30', conds: [{ label: 'addr', now: addr, op: '<', ref: addrAvg }] }]);
  }

  if (ctx.position <= 0 && growing) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position > 0 && !growing) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
