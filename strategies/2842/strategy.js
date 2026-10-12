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
 * When it buys and sells: buys when smoothed active addresses are rising
 * (current > ~30 bars ago with 0.3% hysteresis) and stays long while that
 * trend holds; sells when the demand trend turns down.
 * When it does NOT work: on-chain demand and price can diverge for long
 * stretches (e.g. a melt-up with flat addresses, or a flush with addresses
 * still high), so this can be late into rallies or exit too early. It is a
 * slow, low-frequency signal — do not expect it to catch sharp moves.
 *
 * 2026-05-07 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  // Smoothed on-chain active addresses (precomputed in DB).
  const raw = ctx.data('addr_sma30');
  const now = Number(raw);
  if (!Number.isFinite(now) || now <= 0) {
    ctx.watch([]);
    return null;
  }

  // Continuous rolling buffer — NEVER reset between trades.
  const hist = ctx.state.dhist || [];
  hist.push(now);
  if (hist.length > 30) hist.shift();
  ctx.state.dhist = hist;
  if (hist.length < 30) {
    ctx.watch([]);
    return null;
  }

  const demandUp = now > hist[0] * 1.003; // 0.3% hysteresis

  // --- Exit: demand trend turned down -> step aside ---
  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      note: 'demand trend down',
      conds: [{ label: 'AddrSMA30 <= ref', now: now, op: '<=', ref: hist[0] * 1.003 }]
    }]);
    if (!demandUp) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: only when demand is rising ---
  ctx.watch([{
    side: 'buy',
    note: 'demand trend up',
    conds: [{ label: 'AddrSMA30 > ref', now: now, op: '>', ref: hist[0] * 1.003 }]
  }]);
  if (demandUp) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
