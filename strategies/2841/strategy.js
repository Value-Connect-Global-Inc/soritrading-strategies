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
 * When it buys and sells: buys when smoothed active addresses have been
 * rising for 2 consecutive bars (current > ~30 bars ago with 0.3% hysteresis)
 * and stays long while that trend holds; sells when the demand trend has
 * turned down for 2 consecutive bars.
 * When it does NOT work: on-chain demand and price can diverge for long
 * stretches (e.g. a melt-up with flat addresses, or a flush with addresses
 * still high), so this can be late into rallies or exit too early. It is a
 * slow, low-frequency signal — do not expect it to catch sharp moves.
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
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

  // 2-bar confirmation: track the last 2 signals.
  const sig = ctx.state.sig || [];
  sig.push(demandUp ? 1 : 0);
  if (sig.length > 2) sig.shift();
  ctx.state.sig = sig;
  if (sig.length < 2) {
    ctx.watch([]);
    return null;
  }
  const confirmedUp = sig[0] === 1 && sig[1] === 1;
  const confirmedDown = sig[0] === 0 && sig[1] === 0;

  // --- Exit: demand trend down 2 bars -> step aside ---
  if (pos > 0) {
    ctx.watch([{ side: 'sell', note: 'Demand downtrend exit', conds: [{ label: '2-bar demand down', ok: confirmedDown }] }]);
    if (confirmedDown) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: demand rising 2 bars ---
  ctx.watch([{ side: 'buy', note: 'Demand uptrend entry', conds: [{ label: '2-bar demand up', ok: confirmedUp }] }]);
  if (confirmedUp) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
