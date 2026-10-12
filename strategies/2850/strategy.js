/*
 * @coinsori-strategy v1
 * name: On-Chain Demand Trend BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's on-chain active-address count is a leading
 * indicator of network adoption and demand. When smoothed active addresses
 * are rising, buyers are entering the network and price tends to follow;
 * when they are contracting, demand is leaving and price tends to weaken.
 * This bets directly on that on-chain demand trend rather than on price.
 * It requires BOTH active addresses AND mining hashrate to be rising, so
 * the long regime is only entered when the whole network is growing.
 * When it buys and sells: buys when both smoothed active addresses and
 * hashrate are rising (current > ~30 bars ago with 0.3% hysteresis) and
 * stays long while that joint trend holds; sells when either turns down.
 * When it does NOT work: on-chain demand and price can diverge for long
 * stretches (e.g. a melt-up with flat addresses, or a flush with addresses
 * still high), so this can be late into rallies or exit too early. Requiring
 * both signals also makes it even more conservative — it can miss rallies
 * driven by only one of the two. It is a slow, low-frequency signal.
 */
// 2026-04-27 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  // Smoothed on-chain active addresses AND hashrate (both precomputed in DB).
  const addr = Number(ctx.data('addr_sma30'));
  const hash = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(addr) || addr <= 0) {
    ctx.watch([]);
    return null;
  }
  if (!Number.isFinite(hash) || hash <= 0) {
    ctx.watch([]);
    return null;
  }

  // Continuous rolling buffers — NEVER reset between trades.
  const ahist = ctx.state.ahist || [];
  ahist.push(addr);
  if (ahist.length > 30) ahist.shift();
  ctx.state.ahist = ahist;

  const hhist = ctx.state.hhist || [];
  hhist.push(hash);
  if (hhist.length > 30) hhist.shift();
  ctx.state.hhist = hhist;

  if (ahist.length < 30 || hhist.length < 30) {
    ctx.watch([]);
    return null;
  }

  const addrUp = addr > ahist[0] * 1.003; // 0.3% hysteresis
  const hashUp = hash > hhist[0] * 1.003;
  const bothUp = addrUp && hashUp;

  // --- Exit: either demand or hashrate trend turns down -> step aside ---
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', note: 'exit: on-chain demand breaks', conds: [
        { label: 'joint trend broken', ok: !bothUp }
      ]}
    ]);
    if (!bothUp) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: both must be rising ---
  ctx.watch([
    { side: 'buy', note: 'entry: on-chain demand rising', conds: [
      { label: 'addr rising', ok: addrUp },
      { label: 'hash rising', ok: hashUp }
    ]}
  ]);
  if (bothUp) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
