/*
 * @coinsori-strategy v1
 * name: On-Chain Network-Health BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A fundamentally different family from price-based
 * mean-reversion/trend. It reads BTC on-chain network health: when the number
 * of active addresses is rising (current usage above its 30-day average), the
 * network is in an accumulation/healthy phase and BTC tends to trend up. This
 * is a macro/fundamental regime filter, not a price pattern.
 * When it buys and sells: buys BTC when price is above the 200-SMA AND active
 * addresses are above their 30-day average (network usage growing); exits when
 * price drops below the 50-SMA or network usage rolls over.
 * When it does NOT work: on-chain data lags fast sentiment moves; in a price
 * crash that happens faster than usage can fall it whipsaws; and it stays in
 * cash during quiet low-usage accumulation that later rallies. Needs the
 * user's on-chain data feed to be live.
 * 2026-04-26: ctx.watch 표시만 추가, 매매 판단은 그대로.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (sma200 == null || sma50 == null) {
    ctx.watch([]);
    return null;
  }

  const addr = ctx.data('addr');        // current active addresses
  const addrSma = ctx.data('addr_sma30'); // 30-day average of active addresses
  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    // exit on trend break or on-chain usage rollover
    const watch = [];
    watch.push({ side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 exit' });
    if (addr != null && addrSma != null) {
      watch.push({ side: 'sell', note: 'addr rollover', conds: [{ label: 'addr', now: addr, op: '<', ref: addrSma }] });
    }
    ctx.watch(watch);

    if (price < sma50 || (addr != null && addrSma != null && addr < addrSma)) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (price < sma200) {
    // only buy above the long-term trend
    const entry = { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 entry' };
    if (addr != null && addrSma != null) {
      entry.conds = [{ label: 'addr', now: addr, op: '>', ref: addrSma }];
    } else {
      entry.conds = [{ label: 'addr data ready', ok: addr != null && addrSma != null }];
    }
    ctx.watch([entry]);
    return null;
  }

  // buy only when network usage is growing (on-chain health improving)
  if (addr != null && addrSma != null && addr > addrSma) {
    ctx.watch([]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  const entry = { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 entry' };
  if (addr != null && addrSma != null) {
    entry.conds = [{ label: 'addr', now: addr, op: '>', ref: addrSma }];
  } else {
    entry.conds = [{ label: 'addr data ready', ok: addr != null && addrSma != null }];
  }
  ctx.watch([entry]);
  return null;
}
