/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Capitulation Bottom-Fish 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain network usage (daily active addresses) is data price
 * alone cannot see. A sharp collapse of active addresses below their 30-day
 * average while the market is already oversold marks a capitulation bottom — the
 * crowd has stopped using and trading the network, a classic contrarian buy zone.
 * When it buys and sells: Buys when active addresses fall below 0.85x their 30-day
 * average AND RSI(14) is below 35 AND price is below its 200-day average (bear
 * market capitulation). Sells when price recovers above the 200-day average, or
 * RSI rises above 60, or price falls 20% below entry.
 * When it does NOT work: In a prolonged bear market capitulation signals fire
 * repeatedly while price keeps grinding lower — the 20% stop is the only defence
 * and it can be hit many times. It also sits out bull markets entirely (price is
 * above the 200-day average, so no entries).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (addr == null || addrSma == null || rsi == null || sma200 == null) return null;

  const pos = ctx.position;
  const entry = ctx.entryPx != null ? ctx.entryPx : (ctx.state && ctx.state.entryPx);

  ctx.watch([
    { side: 'buy', note: 'addr collapse + oversold', conds: [{ label: 'addr/addrSMA30', now: addr / addrSma, op: '<', ref: 0.85, closed: true }, { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true }, { label: 'price<SMA200', ok: price < sma200 }] },
    { side: 'sell', price: sma200, trigger: 'above', note: 'recovered above 200d' },
    { side: 'sell', note: '20% hard stop', conds: [{ label: 'price vs entry', ok: entry != null && price < entry * 0.8 }] }
  ]);

  if (pos > 0) {
    if (price > sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (rsi > 60) return { side: 'sell', qty: pos, reduceOnly: true };
    if (entry != null && price < entry * 0.8) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (ctx.state && ctx.state.entryPx != null) ctx.state.entryPx = null;
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (addr < 0.85 * addrSma && rsi < 35 && price < sma200) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    ctx.state.entryPx = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
