/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Adoption Cycle v2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price follows real network usage, not just
 * sentiment. When the number of daily active addresses grows, real people are
 * using the network and price tends to follow; when usage rolls over, the
 * uptrend is over. Hashrate is a second, slower commitment signal — miners do
 * not unplug quickly, so hashrate above its average confirms the network is
 * healthy. This rides the adoption cycle on-chain instead of the crowd gauge.
 * v2: exit now requires BOTH usage AND hashrate to roll over (v1 exited on a
 * single noisy usage day and churned 130-170 trades).
 * When it buys and sells: buy BTC when active addresses are above their 30-day
 * average AND hashrate is above its 30-day average AND price is above its
 * 200-day average. Sell when BOTH active addresses and hashrate fall back
 * below their 30-day averages, or when price drops 25% below entry (hard stop).
 * When it does NOT work: in a long sideways chop addresses can hover around
 * their average and whipsaw entries; the stop turns a normal shakeout into a
 * realized loss. In a price spike driven purely by speculation (no usage
 * growth), the strategy stays out and misses the move.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number. Missing data = no trade.
  const addr = Number(ctx.data('addr'));
  const addrAvg = Number(ctx.data('addr_sma30'));
  const hr = Number(ctx.data('hashrate'));
  const hrAvg = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(addr) || !Number.isFinite(addrAvg) ||
      !Number.isFinite(hr) || !Number.isFinite(hrAvg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on the position.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Exit: confirmed trend break — BOTH usage and hashrate rolled over.
    if (addr < addrAvg && hr < hrAvg) return { side: 'sell', qty: pos };
    return null;
  }

  // Regime gate: only buy above the long-term trend (closed bar).
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Entry: adoption expanding (usage above 30d avg) + miners committed.
  if (addr > addrAvg && hr > hrAvg && price > sma200) {
    // Fixed 95% sizing — matches the proven baseline sizing.
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'enter: usage&hashrate growing, trend up',
    conds: [{ label: 'Active addr > 30d avg', ok: addr > addrAvg },
            { label: 'Hashrate > 30d avg', ok: hr > hrAvg }]
  }]);
  return null;
}
