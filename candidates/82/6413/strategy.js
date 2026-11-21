/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Address Momentum 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends follow network usage. When the number of daily
 * unique active addresses is growing (above its own 30-day average), the network
 * is expanding and price tends to follow; when it shrinks, the network is
 * contracting. This is a different data axis from price indicators — it often
 * turns before price does.
 * When it buys and sells: buys when the daily close is above its 200-day SMA
 * AND active addresses are above their 30-day average; sells when either flips.
 * When it does NOT work: in a bull market where price rises without new users
 * (address growth lags a price-only rally), it stays flat and misses upside;
 * address data is daily so intra-day moves are invisible; in chop near the
 * 200-day line it whipsaws and pays fees. It never shorts, so it earns nothing
 * in bear markets.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) return null;

  // On-chain regime: active addresses vs their own 30-day average.
  const addr = ctx.data('main.addr');
  const addrSma = ctx.data('main.addr_sma30');
  if (addr == null || addrSma == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const networkUp = addr > addrSma;

  const watchList = [];
  if (pos > 0) {
    watchList.push(
      { side: 'sell', price: sma200, trigger: 'below', note: 'Regime death cross' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'Network shrinking', conds: [{ label: 'addr vs sma30', ok: networkUp }] }
    );
  } else {
    watchList.push(
      { side: 'buy', price: sma200, trigger: 'above', note: 'Regime up + network', conds: [{ label: 'addr vs sma30', ok: networkUp }] }
    );
  }
  ctx.watch(watchList);

  if (pos > 0) {
    // Exit if price drops below the 200-day line OR the network is contracting.
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (!networkUp) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Flat: enter only when both the price regime and the on-chain regime agree.
  if (pos === 0 && prevClose > sma200 && networkUp) {
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty };
  }
  return null;
}
