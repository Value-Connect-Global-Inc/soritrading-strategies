/*
 * @coinsori-strategy v1
 * name: OnChainNetworkTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network health — how many active addresses are
 * transacting — tends to expand before and during bull runs and contract in
 * bear markets. Tracking that on-chain growth gives a fundamental signal that
 * is independent of price-chart patterns.
 * When it buys and sells: buys when active addresses are above their 30-day
 * average (network growing) AND price is above its 200-day average (long-term
 * uptrend intact). Sells when address growth flips negative, when the 200-day
 * trend breaks, or on a hard 3x ATR stop below entry.
 * When it does NOT work: in a sideways chop where addresses oscillate around
 * their average it whipsaws; it also misses fast V-shaped recoveries because
 * it waits for both on-chain growth and the 200-day trend to confirm.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const s200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || addrSma <= 0) return null;
  if (s200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const networkGrowing = addr > addrSma;
  const inTrend = prevClose > s200;

  if (pos > 0) {
    // Exit on on-chain contraction, trend break, or hard 3x ATR stop.
    const hardStop = ctx.entryPx - 3 * atr;
    if (price <= hardStop || !networkGrowing || !inTrend) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  if (inTrend && networkGrowing) {
    // Half cash per trade so a bad stretch cannot ruin the account.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash * 0.5) / price * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'on-chain + trend entry', conds: [
    { label: 'Addr > its 30d avg', ok: networkGrowing, closed: true },
    { label: 'Close > SMA200', ok: inTrend, closed: true }
  ]}]);
  return null;
}
