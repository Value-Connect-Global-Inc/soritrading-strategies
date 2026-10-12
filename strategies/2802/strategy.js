/*
 * @coinsori-strategy v1
 * name: SOL 1D Fed-Funds Rate Regime Gate
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The monetary-policy regime gate was validated on Bitcoin
 * and Ethereum 1D — hold while the central bank is not aggressively hiking,
 * move to cash in a tightening cycle. This is an out-of-sample test of whether
 * that macro signal generalizes to a third crypto asset (Solana), which is
 * younger and more volatile than BTC/ETH.
 * When it buys and sells: stays invested in SOL as long as the fed funds rate
 * is not more than ~0.5pp above where it was ~30 days earlier; sells to cash
 * when the rate jumps that much (a real hiking step) and waits for it to stop.
 * When it does NOT work: it rides full SOL drawdowns during non-hiking periods
 * (no price stop, only the policy gate), and SOL is far more volatile than
 * BTC/ETH so those drawdowns can be very deep; it also misses melt-ups if the
 * gate keeps it out too long after a hiking cycle ends.
 * 2026-04-12: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fedNow = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fedNow == null || fedLag == null) return null;

  // Tightening = current rate meaningfully above its level ~30 rows ago.
  const tightening = fedNow > fedLag + 0.5;

  // No price/time condition drives entries or exits — the fed-funds regime
  // gate is a macro condition only, so there is no price level to watch.
  ctx.watch([]);

  const pos = ctx.position;
  if (pos > 0 && tightening) {
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && !tightening) {
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
