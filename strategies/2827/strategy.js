/*
 * @coinsori-strategy v1
 * name: Composite On-Chain Demand BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Two independent on-chain fundamentals — active network
 * addresses (user demand) and miner hashrate (producer commitment) — each rise
 * in healthy bull phases and stall or fall in capitulation. Requiring BOTH to
 * confirm is a stronger, more selective signal than either alone, and selling
 * when EITHER turns down exits faster than a single-signal version — targeting
 * the family's known weakness of lagging price in bears (high drawdown).
 * When it buys and sells: holds Bitcoin only while BOTH the 30-day-smoothed
 * active-address count AND the 30-day-smoothed hashrate are rising vs ~30 days
 * earlier. Sells to cash when EITHER signal turns down.
 * When it does NOT work: on-chain data is daily and lags price, so in a sharp
 * V-shaped melt-up it re-enters late and trails buy-and-hold; and requiring both
 * signals means it is fully out during mixed regimes where only one is rising.
 *
 * 2025-01-01: display-only change (ctx.watch added), trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = Number(ctx.data('addr_sma30'));
  const hr = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(addr) || addr <= 0) return null;
  if (!Number.isFinite(hr) || hr <= 0) return null;

  // Rolling history of both smoothed series for the "vs ~30 bars ago" comparison.
  const st = ctx.state;
  if (!st.aHist) st.aHist = [];
  if (!st.hHist) st.hHist = [];
  st.aHist.push(addr);
  st.hHist.push(hr);
  if (st.aHist.length > 30) st.aHist.shift();
  if (st.hHist.length > 30) st.hHist.shift();
  if (st.aHist.length < 30 || st.hHist.length < 30) return null;
  const aPast = st.aHist[0];
  const hPast = st.hHist[0];

  // Hysteresis band on the smoothed series (1%) — fewer, more decisive flips.
  const aRising = addr > aPast * 1.01;
  const aFalling = addr < aPast * 0.99;
  const hRising = hr > hPast * 1.01;
  const hFalling = hr < hPast * 0.99;

  if (pos > 0) {
    // Exit when EITHER fundamental turns down — faster bear exit than one signal alone.
    if (aFalling || hFalling) {
      ctx.watch([
        { side: 'sell', price: ctx.entryPx * 0.99, trigger: 'below', qty: pos, note: 'addr falling', conds: [{ label: 'addr sma30', now: addr, op: '<', ref: aPast * 0.99, closed: true }] },
        { side: 'sell', price: ctx.entryPx * 0.99, trigger: 'below', qty: pos, note: 'hashrate falling', conds: [{ label: 'hashrate sma30', now: hr, op: '<', ref: hPast * 0.99, closed: true }] }
      ]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: aPast * 0.99, trigger: 'below', qty: pos, note: 'addr turns down', conds: [{ label: 'addr sma30', now: addr, op: '>', ref: aPast * 1.01, closed: true }] },
      { side: 'sell', price: hPast * 0.99, trigger: 'below', qty: pos, note: 'hashrate turns down', conds: [{ label: 'hashrate sma30', now: hr, op: '>', ref: hPast * 1.01, closed: true }] }
    ]);
    return null;
  }

  // Enter only when BOTH fundamentals confirm a healthy network.
  if (aRising && hRising) {
    ctx.watch([
      { side: 'buy', price: price, trigger: 'above', qty: ctx.cash / price * 0.95, note: 'both signals up', conds: [{ label: 'addr rising', ok: true }, { label: 'hashrate rising', ok: true }] }
    ]);
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  ctx.watch([
    { side: 'buy', price: aPast * 1.01, trigger: 'above', qty: ctx.cash / price * 0.95, note: 'addr rises', conds: [{ label: 'addr sma30', now: addr, op: '>', ref: aPast * 1.01, closed: true }] },
    { side: 'buy', price: hPast * 1.01, trigger: 'above', qty: ctx.cash / price * 0.95, note: 'hashrate rises', conds: [{ label: 'hashrate sma30', now: hr, op: '>', ref: hPast * 1.01, closed: true }] }
  ]);
  return null;
}
