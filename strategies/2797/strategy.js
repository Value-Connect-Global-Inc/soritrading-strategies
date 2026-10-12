// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
/*
 * @coinsori-strategy v1
 * name: BTC 1D Fed-Funds Rate Regime Gate
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A genuinely different signal source — monetary policy
 * instead of price. When the central bank is actively RAISING rates (a
 * tightening cycle) risk assets like crypto tend to fall; when it is cutting
 * or holding, liquidity supports them. This strategy holds Bitcoin while the
 * fed funds rate is NOT aggressively rising, and moves to cash when the Fed
 * is clearly tightening. It is a slow, low-turnover macro regime switch.
 * When it buys and sells: it stays invested in BTC as long as the fed funds
 * rate is not more than ~0.5 percentage points above where it was roughly a
 * month earlier. When the rate has jumped that much (a real hiking step), it
 * sells to cash and waits until the rate stops rising.
 * When it does NOT work: it rides full market drawdowns during non-hiking
 * periods (it has no price stop, only the policy gate), so a crypto crash
 * that happens while the Fed is on hold hits it fully. It also misses
 * melt-ups if the gate keeps it out too long after a hiking cycle ends.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  // Current fed funds rate and its level ~30 rows ago.
  const fedNow = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fedNow == null || fedLag == null) { ctx.watch([]); return null; }

  // Tightening = current rate is meaningfully above where it was recently.
  // 0.5pp is a single typical Fed hike, so it marks an active hiking step.
  const tightening = fedNow > fedLag + 0.5;

  const pos = ctx.position;
  if (pos > 0 && tightening) {
    ctx.watch([]);
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && !tightening) {
    ctx.watch([]);
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }

  // No order this tick — declare what we are waiting for.
  if (pos > 0) {
    ctx.watch([{ side: 'sell', note: 'Fed hiking step', conds: [{ label: 'Fed funds rate', now: fedNow, op: '>', ref: fedLag + 0.5 }] }]);
  } else if (pos === 0) {
    ctx.watch([{ side: 'buy', note: 'Fed pause/cut', conds: [{ label: 'Fed funds rate', now: fedNow, op: '<=', ref: fedLag + 0.5 }] }]);
  } else {
    ctx.watch([]);
  }
  return null;
}
