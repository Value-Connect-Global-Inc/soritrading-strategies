/*
 * @coinsori-strategy v1
 * name: OnChain Growth BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: When the Bitcoin network is growing — hash rate and active addresses
 *   above their own 30-day averages — it usually precedes or accompanies price gains.
 *   This is a fundamentals family, not price/sentiment.
 * When it buys and sells: Buys when BOTH hash rate and active addresses are above their
 *   30-day averages (network expanding). Sells when EITHER falls below its 30-day average
 *   (network contracting), or a -20% hard stop.
 * When it does NOT work: Hash rate is a lagging/coincident indicator that mostly rises over
 *   time, so it may keep you out during price rallies that happen without new mining capacity.
 *   It can also whipsaw at cycle tops where hashrate peaks while price falls.
 */
function onUpdate(ctx) {
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (hr == null || hrSma == null || addr == null || addrSma == null) return null;
  const price = ctx.price;
  const networkGrowing = hr > hrSma && addr > addrSma;

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: ctx.price, note: 'network growing',
      conds: [{ label: 'hashrate>sma30', ok: hr > hrSma, closed: true },
              { label: 'addr>sma30', ok: addr > addrSma, closed: true }] }]);
    if (networkGrowing) {
      return { side: 'buy', qty: ctx.cash / price * 0.98 };
    }
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) return null;
  const stop = entry * 0.80; // -20% hard stop: one losing trade cannot ruin the account
  ctx.watch([{ side: 'sell', price: Math.max(stop, ctx.price), trigger: 'below', note: 'stop' },
             { side: 'sell', price: ctx.price, note: 'network contracting',
               conds: [{ label: 'network shrink', ok: !networkGrowing, closed: true }] }]);
  if (!networkGrowing || price <= stop) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
