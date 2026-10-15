/*
 * @coinsori-strategy v1
 * name: On-chain Network Breakout (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A 55-day close high breakout is a proven trend trigger
 * (the ETH champion uses the same), and adding an on-chain confirmation —
 * daily active addresses above their 30-day average — filters out weak,
 * speculative breakouts that lack real network growth behind them.
 * When it buys and sells: buys when the close makes a new 55-day high AND
 * active addresses are above their 30-day average. Sells on a 20-day close
 * low or a 25% hard stop.
 * When it does NOT work: in sideways chop the 55/20 breakout whipsaws; when
 * address data lags a real rally it misses early entries and buys late.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null; // need 55 + 20 bars history

  // CLOSED bars only: prevClose is the last closed bar, the channel is built
  // from bars STRICTLY BEFORE it, so a new high can actually trigger.
  const prevClose = closes[n - 2];

  // Highest close of the 55 closed bars before prevClose (excludes prevClose).
  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  // Lowest close of the 20 closed bars before prevClose (excludes prevClose).
  let lo20 = Infinity;
  for (let i = n - 2 - 20; i <= n - 3; i++) {
    if (closes[i] < lo20) lo20 = closes[i];
  }

  // On-chain: daily active addresses vs their 30-day average (network expanding?)
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const netGrowing = addr != null && addrAvg != null && addr > addrAvg;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75; // hard stop 25% below entry (tighter than champion's 30%)
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: 'exit: 20d low' }]);
    return null;
  }

  const breakout = prevClose > hi55;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'network growing (addr>30d avg)', ok: netGrowing, closed: true }] }]);
  if (!breakout || !netGrowing) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
