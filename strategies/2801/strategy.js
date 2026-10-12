/*
 * @coinsori-strategy v1
 * name: ETH 1D Fed-Funds Rate Regime Gate
 * ex: binance
 * syms: ETHUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The same monetary-policy signal that was validated on
 * Bitcoin — hold while the central bank is not aggressively hiking, move to
 * cash in a tightening cycle. This tests whether that macro gate generalizes
 * to Ethereum. If the policy-driven liquidity regime is a real driver of
 * crypto risk appetite, it should help ETH the same way it helped BTC.
 * When it buys and sells: stays invested in ETH as long as the fed funds rate
 * is not more than ~0.5pp above where it was ~30 days earlier; sells to cash
 * when the rate jumps that much (a real hiking step) and waits for it to stop.
 * When it does NOT work: it rides full ETH drawdowns during non-hiking periods
 * (no price stop, only the policy gate), and ETH is more volatile than BTC so
 * those drawdowns can be deep; it also misses melt-ups if the gate keeps it
 * out too long after a hiking cycle ends.
 *
 * 2026-02-11 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  // This strategy has no price/time wait condition — it only waits for the
  // fed funds rate regime to flip, which the watch card cannot express as a
  // price level. Declare an empty watch list every tick.
  ctx.watch([]);

  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fedNow = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fedNow == null || fedLag == null) return null;

  // Tightening = current rate meaningfully above its level ~30 rows ago.
  const tightening = fedNow > fedLag + 0.5;

  const pos = ctx.position;
  if (pos > 0 && tightening) {
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && !tightening) {
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
